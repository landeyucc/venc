// 该Worker负责处理文件的加密和解密操作，包括AES-GCM加密与解密、venc文件标准与vkey恢复秘钥生成等。

// Base64工具函数
const base64 = {
  encode: (uint8Array) => {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  },
  decode: (base64String) => {
    const binary = atob(base64String);
    const len = binary.length;
    const uint8Array = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }
    return uint8Array;
  }
};

// 计算SHA-256哈希
async function calculateSha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// 生成16字节的标识符，前4字节固定为VENC，后12字节随机
function generateIdentifier() {
  const identifier = new Uint8Array(16);
  // 前4个字节设置为"VENC"
  const vencPrefix = new TextEncoder().encode('VENC');
  identifier.set(vencPrefix, 0);
  // 后12个字节设置为随机值
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  identifier.set(randomBytes, 4);
  return identifier;
}

// 生成256位AES-GCM密钥
async function generateFileKey() {
  return crypto.getRandomValues(new Uint8Array(32)); // 32字节 = 256位
}

// 使用PBKDF2派生密钥加密密钥(KEK)
async function deriveKek(password, salt) {
  // 注意：这里使用VENCLITE作为vkey标识符，确保vkey文件可以独立使用
  const passwordData = new TextEncoder().encode(password || 'VENCRKEY');
  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// 使用KEK加密文件密钥
async function encryptFileKey(fileKey, kek) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM标准IV长度为12字节
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    kek,
    fileKey
  );
  // 返回IV + 加密数据
  return new Uint8Array([...iv, ...new Uint8Array(encryptedData)]);
}

// 使用KEK解密文件密钥
async function decryptFileKey(encryptedFileKey, kek) {
  const iv = encryptedFileKey.slice(0, 12);
  const ciphertext = encryptedFileKey.slice(12);
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    kek,
    ciphertext
  );
  return new Uint8Array(decryptedData);
}

// 分块加密文件
async function encryptFileChunks(fileData, fileKey, progressCallback) {
  const chunkSize = 8 * 1024 * 1024; // 8MB块，增大块大小以提高大文件处理效率
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 全局IV
  const importedKey = await crypto.subtle.importKey(
    'raw',
    fileKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // 使用块数组存储加密数据，避免一次性分配大内存
  const encryptedChunks = [];
  // 先添加IV作为第一个块
  encryptedChunks.push(iv);

  let totalProcessed = 0;
  let lastProgressUpdate = 0;
  const updateInterval = 0.1; // 每0.1%更新一次进度，以支持两位小数显示

  while (totalProcessed < fileData.length) {
    // 使用setTimeout让出执行权，避免阻塞UI
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const chunk = fileData.slice(totalProcessed, totalProcessed + chunkSize);
    const encryptedChunk = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: new TextEncoder().encode(`chunk_${Math.floor(totalProcessed / chunkSize)}`)
      },
      importedKey,
      chunk
    );
    
    encryptedChunks.push(new Uint8Array(encryptedChunk));
    totalProcessed += chunkSize;
    
    // 计算进度并更新，确保精度为两位小数
    const currentProgress = Math.min((totalProcessed / fileData.length) * 100, 100);
    if (currentProgress - lastProgressUpdate >= updateInterval) {
      // 保留两位小数
      const progressPercent = Number(currentProgress.toFixed(2));
      progressCallback(progressPercent);
      lastProgressUpdate = currentProgress;
    }
  }
  
  // 确保发送100%进度表示加密阶段完成
  progressCallback(100);

  // 发送合并文件开始的进度信息
  progressCallback(99, 'merging');
  
  // 最后合并所有块
  const result = mergeUint8Arrays(encryptedChunks);
  
  // 发送合并完成的进度信息
  progressCallback(100, 'merging');
  
  return result;
}

// 分块解密文件
async function decryptFileChunks(encryptedData, fileKey, progressCallback) {
  const chunkSize = 8 * 1024 * 1024 + 16; // 8MB块大小 + 认证标签，与加密保持一致
  const iv = encryptedData.slice(0, 12);
  const importedKey = await crypto.subtle.importKey(
    'raw',
    fileKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 使用块数组存储解密数据，避免一次性分配大内存
  const decryptedChunks = [];

  let totalProcessed = 0;
  let position = 12;
  let lastProgressUpdate = 0;
  const updateInterval = 0.1; // 每0.1%更新一次进度，以支持两位小数显示

  while (position < encryptedData.length) {
    // 使用setTimeout让出执行权，避免阻塞UI
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // 预估块大小，确保不越界
    const remainingBytes = encryptedData.length - position;
    const chunkSizeToRead = Math.min(chunkSize, remainingBytes);
    const chunk = encryptedData.slice(position, position + chunkSizeToRead);
    
    try {
      const decryptedChunk = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: new TextEncoder().encode(`chunk_${Math.floor(totalProcessed / (chunkSize - 16))}`)
        },
        importedKey,
        chunk
      );
      
      decryptedChunks.push(new Uint8Array(decryptedChunk));
      
      position += chunkSizeToRead;
      totalProcessed += chunkSizeToRead - 16; // 减去认证标签长度
      
      // 计算进度并更新
      const currentProgress = Math.min((position / encryptedData.length) * 100, 100);
      if (currentProgress - lastProgressUpdate >= updateInterval) {
        // 保留两位小数
        const progressPercent = Number(currentProgress.toFixed(2));
        progressCallback(progressPercent);
        lastProgressUpdate = currentProgress;
      }
    } catch (error) {
      throw new Error('workerErrorCorruptedOrWrongPassword');
    }
  }
  
  // 确保发送100%进度表示解密阶段完成
  progressCallback(100);

  // 发送合并文件开始的进度信息
  progressCallback(99, 'merging');
  
  // 最后合并所有块
  const result = mergeUint8Arrays(decryptedChunks);
  
  // 发送合并完成的进度信息
  progressCallback(100, 'merging');
  
  return result;
}

// 合并Uint8Array数组
function mergeUint8Arrays(arrays) {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    // 添加边界检查，确保不会超出数组范围
    if (offset + arr.length <= result.length) {
      result.set(arr, offset);
      offset += arr.length;
    } else {
      throw new Error('workerErrorArrayMergeOutOfRange');
    }
  }
  return result;
}

// VENC系统标识符 - 前32字节固定
const VENC_SYSTEM_IDENTIFIER = new TextEncoder().encode('VENC_FILE_ENCRYPTION_SYSTEM_2025');

// 构建自定义文件头
function buildCustomHeader(hashValue, originalFileName) {
  // 确保系统标识符为32字节，不足补0，超过截断
  const systemId = new Uint8Array(32);
  const idLength = Math.min(VENC_SYSTEM_IDENTIFIER.length, 32);
  systemId.set(VENC_SYSTEM_IDENTIFIER.slice(0, idLength));
  
  // 哈希值长度（4字节）
  const hashLengthBytes = new Uint8Array(4);
  const hashLengthView = new DataView(hashLengthBytes.buffer);
  hashLengthView.setUint32(0, hashValue.length, true);
  
  // 文件名区域（256字节）- 包含base64编码的原始文件名，不足补0
  const fileNameArea = new Uint8Array(256);
  
  // 处理文件名，进行base64编码
  let base64EncodedFileName = '';
  if (originalFileName) {
    // 对文件名进行base64编码
    const encoder = new TextEncoder();
    const fileNameBytes = encoder.encode(originalFileName);
    base64EncodedFileName = base64.encode(fileNameBytes);
  } else {
    base64EncodedFileName = 'unnamed_file';
  }
  
  // 将base64编码的文件名存储到256字节区域
  const encodedFileNameBytes = new TextEncoder().encode(base64EncodedFileName);
  fileNameArea.set(encodedFileNameBytes.slice(0, Math.min(encodedFileNameBytes.length, 256)));
  
  // 合并所有部分
  return mergeUint8Arrays([
    systemId,
    hashLengthBytes,
    hashValue,
    fileNameArea
  ]);
}

// 解析自定义文件头
function parseCustomHeader(headerData) {
  let offset = 0;
  
  // 系统标识符（32字节）
  const systemId = headerData.slice(offset, offset + 32);
  offset += 32;
  
  // 验证系统标识符
  for (let i = 0; i < Math.min(systemId.length, VENC_SYSTEM_IDENTIFIER.length); i++) {
    if (systemId[i] !== VENC_SYSTEM_IDENTIFIER[i]) {
      throw new Error('workerErrorInvalidSystemIdentifier');
    }
  }
  
  // 哈希值长度（4字节）
  const hashLengthView = new DataView(headerData.buffer, offset, 4);
  const hashLength = hashLengthView.getUint32(0, true);
  offset += 4;
  
  // 哈希值
  const hashValue = headerData.slice(offset, offset + hashLength);
  offset += hashLength;
  
  // 文件名区域（256字节）
  const fileNameBytes = headerData.slice(offset, offset + 256);
  offset += 256;
  
  // 解码并提取base64编码的文件名
  let originalFileName = 'decrypted_file';
  try {
    // 将文件名字节解码为字符串
    const fileNameArea = new TextDecoder().decode(fileNameBytes);
    
    // 移除文件名后的空字符
    const cleanFileName = fileNameArea.split('\0')[0].trim();
    
    // 尝试base64解码
    if (cleanFileName && cleanFileName !== 'unnamed_file') {
      const decodedData = base64.decode(cleanFileName);
      originalFileName = new TextDecoder().decode(decodedData);
    }
  } catch (e) {
    // 如果解码失败，使用默认文件名
    console.warn('workerErrorFileNameDecodingFailed');
  }
  
  return {
    systemId,
    hashValue,
    originalFileName,
    totalLength: offset
  };
}

// Worker消息处理
self.onmessage = async (e) => {
  const { type, data } = e.data;
  try {
    switch (type) {
      // 加密流程
      case 'ENCRYPT': {        
        const { fileData, password, fileName } = data;
        // 修改progressCallback以支持stage参数
        const progressCallback = (percent, stage = 'encrypting') => {
          self.postMessage({ type: 'PROGRESS', data: { percent, module: 'encrypt', stage } });
        };

        // 1. 生成核心数据
        const identifier = generateIdentifier(); // 生成随机标识符
        const fileKey = await generateFileKey(); // 生成随机文件加密密钥
        
        // 2. 计算文件内容的SHA-256哈希值
        const fileHash = await calculateSha256(fileData);
        
        // 4. 创建用于加密文件的头部数据
        // 头部包含: identifier(16字节) + 使用密码加密的fileKey(至少28字节)
        const passwordKek = await deriveKek(password, identifier);
        const encryptedFileKeyWithPassword = await encryptFileKey(fileKey, passwordKek);
        const headerData = mergeUint8Arrays([identifier, encryptedFileKeyWithPassword]);
        
        // 5. 加密文件内容
        const encryptedContent = await encryptFileChunks(fileData, fileKey, progressCallback);
        
        // 6. 构建自定义文件头 - 传递完整原始文件名
        const customHeader = buildCustomHeader(fileHash, fileName);
        
        // 7. 组合所有部分
        const encryptedFileData = mergeUint8Arrays([headerData, customHeader, encryptedContent]);
        
        // 8. 生成vkey文件内容
        // vkey文件格式：identifier(16字节) + 使用空密码加密的fileKey(至少28字节)
        const vkeyKek = await deriveKek('', identifier);
        const encryptedFileKeyForVkey = await encryptFileKey(fileKey, vkeyKek);
        const vkeyData = mergeUint8Arrays([identifier, encryptedFileKeyForVkey]);

        // 9. 返回结果
        self.postMessage({
          type: 'SUCCESS',
          data: {
            module: 'encrypt',
            encryptedFileData,
            vkeyBase64: base64.encode(vkeyData)
          }
        });

        break;
      }

      // 解密流程
      case 'DECRYPT': {        
        const { encryptedFileData, vkeyBase64, password, fileExtension } = data;
        // 修改progressCallback以支持stage参数
        const progressCallback = (percent, stage = 'decrypting') => {
          self.postMessage({ type: 'PROGRESS', data: { percent, module: 'decrypt', stage } });
        };

        // 检查文件扩展名是否为.venc
        if (fileExtension && fileExtension.toLowerCase() !== '.venc') {
          throw new Error('workerErrorUnsupportedFileFormat');
        }
        
        // 检查文件是否包含VENC标识符
        if (encryptedFileData.length < 16) {
          throw new Error('workerErrorFileTooSmall');
        }

        // 1. 获取文件密钥
        let fileKey;
        let identifier = encryptedFileData.slice(0, 16); // 提取标识符
        
        // 验证标识符前几个字节是否符合预期格式（VENC开头）
        const validIdentifierPrefix = new TextEncoder().encode('VENC');
        let isValidIdentifier = true;
        for (let i = 0; i < validIdentifierPrefix.length && i < identifier.length; i++) {
          if (identifier[i] !== validIdentifierPrefix[i]) {
            isValidIdentifier = false;
            break;
          }
        }
        
        if (!isValidIdentifier) {
          throw new Error('workerErrorInvalidFileIdentifier');
        }
        
        try {
          if (vkeyBase64) {
            // 使用vkey文件解密
            const vkeyData = base64.decode(vkeyBase64);
            const vkeyIdentifier = vkeyData.slice(0, 16); // 提取vkey中的标识符
            const encryptedFileKeyData = vkeyData.slice(16); // 提取加密的文件密钥
            
            // 验证vkey文件的标识符是否与加密文件的标识符匹配
            let identifiersMatch = true;
            for (let i = 0; i < identifier.length; i++) {
              if (identifier[i] !== vkeyIdentifier[i]) {
                identifiersMatch = false;
                break;
              }
            }
            
            if (!identifiersMatch) {
              throw new Error('workerErrorVkeyMismatch');
            }
            
            // 派生KEK（使用空密码）
            const vkeyKek = await deriveKek('', identifier);
            fileKey = await decryptFileKey(encryptedFileKeyData, vkeyKek);
          } else if (password) {
            // 使用密码直接解密
            // 尝试不同的头部长度，找到合适的位置
            let headerEndPos = 16 + 28; // 最小头部长度
            let passwordDecryptAttempts = 0;
            const maxPasswordAttempts = 50; // 限制密码解密尝试次数，避免过长时间卡住
            
            while (headerEndPos < encryptedFileData.length && passwordDecryptAttempts < maxPasswordAttempts) {
              try {
                const encryptedFileKeyData = encryptedFileData.slice(16, headerEndPos);
                const passwordKek = await deriveKek(password, identifier);
                fileKey = await decryptFileKey(encryptedFileKeyData, passwordKek);
                break; // 解密成功，退出循环
              } catch (e) {
                // 解密失败，尝试增加头部长度
                headerEndPos += 1;
                passwordDecryptAttempts += 1;
                // 让出执行权，避免阻塞UI
                await new Promise(resolve => setTimeout(resolve, 0));
              }
            }
            
            // 如果超过最大尝试次数或头部长度到达文件末尾，说明密码错误
            if (passwordDecryptAttempts >= maxPasswordAttempts || headerEndPos >= encryptedFileData.length) {
              throw new Error('workerErrorPasswordDecryptionFailed');
            }
          } else {
            throw new Error('workerErrorMissingCredentials');
          }
        } catch (error) {
          throw new Error('解密失败：' + error.message);
        }
        
        // 2. 解析自定义文件头

        // 2. 解析自定义文件头
        let customHeader, fileHash, originalFileName;
        try {
          // 正确计算customHeader的起始位置
          // identifier是16字节，encryptedFileKeyWithPassword的长度是动态的（12字节IV + 加密数据）
          // 我们需要找到系统标识符的位置来确定customHeader的起始位置
          let customHeaderFound = false;
          
          // 从identifier后面开始查找系统标识符
          for (let i = 16; i <= encryptedFileData.length - 32; i++) {
            const potentialSystemId = encryptedFileData.slice(i, i + 32);
            let match = true;
            
            for (let j = 0; j < VENC_SYSTEM_IDENTIFIER.length; j++) {
              if (potentialSystemId[j] !== VENC_SYSTEM_IDENTIFIER[j]) {
                match = false;
                break;
              }
            }
            
            if (match) {
              try {
                customHeader = parseCustomHeader(encryptedFileData.slice(i));
                fileHash = customHeader.hashValue;
                originalFileName = customHeader.originalFileName;
                customHeaderFound = true;
                break;
              } catch (e) {
                // 继续查找下一个可能的位置
              }
            }
          }
          
          if (!customHeaderFound) {
            throw new Error('workerErrorCannotParseHeader');
          }
        } catch (error) {
          throw new Error('解密失败：' + error.message);
        }

        // 3. 解密文件内容
        // 找到文件内容的起始位置（跳过自定义文件头）
        let contentStartPos = 16 + 28 + customHeader.totalLength;
        while (contentStartPos < encryptedFileData.length) {
          try {
            // 尝试解密从当前位置开始的数据
            const encryptedContent = encryptedFileData.slice(contentStartPos);
            const decryptedFileData = await decryptFileChunks(encryptedContent, fileKey, progressCallback);
            
            // 4. 验证解密后内容的哈希值
            const decryptedHash = await calculateSha256(decryptedFileData);
            let hashMatch = true;
            if (decryptedHash.length === fileHash.length) {
              for (let i = 0; i < decryptedHash.length; i++) {
                if (decryptedHash[i] !== fileHash[i]) {
                  hashMatch = false;
                  break;
                }
              }
            } else {
              hashMatch = false;
            }
            
            // 5. 返回结果
            self.postMessage({
              type: 'SUCCESS',
              data: {
                module: 'decrypt',
                decryptedFileData,
                originalFileName: originalFileName,
                hashMatch
              }
            });
            return;
          } catch (e) {
            // 解密失败，尝试增加内容起始位置
            contentStartPos += 1;
            if (contentStartPos >= encryptedFileData.length) {
              throw new Error('workerErrorDecryptionFailed');
            }
          }
        }

        break;
      }

      default:
        throw new Error('workerErrorUnknownOperation');
    }
  } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({
          type: 'ERROR',
          data: {
            module: e.data.type === 'ENCRYPT' ? 'encrypt' : 'decrypt',
            message: error.message || '处理失败，请重试',
            stack: error.stack // 提供更详细的错误信息
          }
        });
      }
};