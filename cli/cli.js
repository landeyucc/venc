#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VENC_SYSTEM_IDENTIFIER = Buffer.from(
  "VENC_FILE_ENCRYPTION_SYSTEM_2025",
  "utf-8",
);

function textEncoderEncode(str) {
  return Buffer.from(str, "utf-8");
}

function textEncoderDecode(buffer) {
  return buffer.toString("utf-8");
}

function generateIdentifier() {
  const identifier = Buffer.alloc(16);
  const vencPrefix = textEncoderEncode("VENC");
  identifier.set(vencPrefix, 0);
  const randomBytes = crypto.randomBytes(12);
  identifier.set(randomBytes, 4);
  return identifier;
}

function generateFileKey() {
  return crypto.randomBytes(32);
}

async function deriveKek(password, salt) {
  const passwordData = textEncoderEncode(password || "VENCRKEY");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      passwordData,
      salt,
      100000,
      32,
      "sha256",
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

function encryptFileKey(fileKey, kek) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
  const encrypted = cipher.update(fileKey);
  cipher.final();
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]);
}

function decryptFileKey(encryptedFileKey, kek) {
  const iv = encryptedFileKey.slice(0, 12);
  const encrypted = encryptedFileKey.slice(12, -16);
  const authTag = encryptedFileKey.slice(-16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

async function calculateSha256(data) {
  return crypto.createHash("sha256").update(data).digest();
}

function mergeBuffers(buffers) {
  return Buffer.concat(buffers);
}

function base64Encode(buffer) {
  return buffer.toString("base64");
}

function base64Decode(str) {
  return Buffer.from(str, "base64");
}

function buildCustomHeader(fileHash, fileName) {
  const systemId = Buffer.alloc(32);
  systemId.set(VENC_SYSTEM_IDENTIFIER.slice(0, 32));

  const hashLengthBytes = Buffer.alloc(4);
  hashLengthBytes.writeUInt32LE(fileHash.length, 0);

  const fileNameArea = Buffer.alloc(256);
  let base64EncodedFileName = "unnamed_file";
  if (fileName) {
    base64EncodedFileName = base64Encode(Buffer.from(fileName, "utf-8"));
  }
  const encodedFileNameBytes = textEncoderEncode(base64EncodedFileName);
  fileNameArea.set(encodedFileNameBytes.slice(0, 256));

  return mergeBuffers([systemId, hashLengthBytes, fileHash, fileNameArea]);
}

function parseCustomHeader(data) {
  let offset = 0;

  const systemId = data.slice(offset, offset + 32);
  offset += 32;

  let isValidSystemId = true;
  for (
    let i = 0;
    i < Math.min(systemId.length, VENC_SYSTEM_IDENTIFIER.length);
    i++
  ) {
    if (systemId[i] !== VENC_SYSTEM_IDENTIFIER[i]) {
      isValidSystemId = false;
      break;
    }
  }

  if (!isValidSystemId) {
    return {
      systemId: null,
      hashValue: null,
      fileNameBytes: null,
      totalLength: 0,
    };
  }

  const hashLength = data.readUInt32LE(offset);
  offset += 4;

  const hashValue = data.slice(offset, offset + hashLength);
  offset += hashLength;

  const fileNameBytes = data.slice(offset, offset + 256);
  offset += 256;

  return {
    systemId,
    hashValue,
    fileNameBytes,
    totalLength: offset,
  };
}

async function encryptFileChunks(fileData, fileKey, progressCallback) {
  const chunkSize = 8 * 1024 * 1024;
  const iv = crypto.randomBytes(12);

  const encryptedChunks = [iv];
  let totalProcessed = 0;

  while (totalProcessed < fileData.length) {
    const chunk = fileData.slice(totalProcessed, totalProcessed + chunkSize);
    const cipher = crypto.createCipheriv("aes-256-gcm", fileKey, iv);
    const additionalData = Buffer.from(
      `chunk_${Math.floor(totalProcessed / chunkSize)}`,
    );
    cipher.setAAD(additionalData);
    const encryptedChunk = cipher.update(chunk);
    cipher.final();
    const authTag = cipher.getAuthTag();
    encryptedChunks.push(Buffer.concat([encryptedChunk, authTag]));
    totalProcessed += chunkSize;

    const progress = Math.min((totalProcessed / fileData.length) * 100, 100);
    if (progressCallback) {
      progressCallback(progress);
    }
  }

  return mergeBuffers(encryptedChunks);
}

async function decryptFileChunks(encryptedData, fileKey) {
  const chunks = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < encryptedData.length) {
    const iv = encryptedData.slice(offset, offset + 12);
    const remaining = encryptedData.slice(offset + 12);

    if (remaining.length < 16) {
      throw new Error("加密数据块太小");
    }

    const ciphertext = remaining.slice(0, -16);
    const authTag = remaining.slice(-16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", fileKey, iv);
    const aad = Buffer.from(`chunk_${chunkIndex}`);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    chunks.push(decrypted);
    offset += 12 + ciphertext.length + 16;
    chunkIndex++;
  }

  return mergeBuffers(chunks);
}

async function encryptFile(inputPath, outputPath, password, options = {}) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  const fileData = fs.readFileSync(inputPath);
  const fileName = options.originalName || path.basename(inputPath);

  console.log("开始加密文件...");
  console.log(`输入文件: ${inputPath}`);
  console.log(`原始文件名: ${fileName}`);

  const identifier = generateIdentifier();
  const fileKey = generateFileKey();

  const fileHash = await calculateSha256(fileData);

  const passwordKek = await deriveKek(password, identifier);
  const encryptedFileKeyWithPassword = encryptFileKey(fileKey, passwordKek);
  const headerData = mergeBuffers([identifier, encryptedFileKeyWithPassword]);

  const encryptedContent = await encryptFileChunks(
    fileData,
    fileKey,
    (progress) => {
      process.stdout.write(`\r加密进度: ${progress.toFixed(2)}%`);
    },
  );
  console.log();

  const customHeader = buildCustomHeader(fileHash, fileName);
  const encryptedFileData = mergeBuffers([
    headerData,
    customHeader,
    encryptedContent,
  ]);

  const vkeyKek = await deriveKek("", identifier);
  const encryptedFileKeyForVkey = encryptFileKey(fileKey, vkeyKek);
  const vkeyData = mergeBuffers([identifier, encryptedFileKeyForVkey]);

  fs.writeFileSync(outputPath, encryptedFileData);
  console.log(`加密文件已保存: ${outputPath}`);

  const vkeyPath = outputPath.replace(/\.venc$/i, "") + ".vkey";
  fs.writeFileSync(vkeyPath, vkeyData);
  console.log(`密钥文件已保存: ${vkeyPath}`);

  console.log("加密完成!");
}

async function decryptFile(inputPath, outputPath, password, vkeyPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  const encryptedFileData = fs.readFileSync(inputPath);

  console.log("开始解密文件...");
  console.log(`输入文件: ${inputPath}`);

  if (encryptedFileData.length < 16) {
    throw new Error("文件太小，不是有效的VENC文件");
  }

  const identifier = encryptedFileData.slice(0, 16);

  const validPrefix = textEncoderEncode("VENC");
  let isValidIdentifier = true;
  for (let i = 0; i < validPrefix.length && i < identifier.length; i++) {
    if (identifier[i] !== validPrefix[i]) {
      isValidIdentifier = false;
      break;
    }
  }

  if (!isValidIdentifier) {
    throw new Error("无效的文件标识符");
  }

  let fileKey;
  let headerEndPos;

  if (vkeyPath && fs.existsSync(vkeyPath)) {
    console.log("使用vkey文件解密...");
    const vkeyData = fs.readFileSync(vkeyPath);
    const vkeyIdentifier = vkeyData.slice(0, 16);
    const encryptedFileKeyData = vkeyData.slice(16);

    let identifiersMatch = true;
    for (let i = 0; i < identifier.length; i++) {
      if (identifier[i] !== vkeyIdentifier[i]) {
        identifiersMatch = false;
        break;
      }
    }

    if (!identifiersMatch) {
      throw new Error("vkey文件与加密文件不匹配");
    }

    const vkeyKek = await deriveKek("", identifier);
    fileKey = decryptFileKey(encryptedFileKeyData, vkeyKek);
    headerEndPos = 16 + encryptedFileKeyData.length;
  } else if (password) {
    console.log("使用密码解密...");
    let headerEndPosTemp = 16 + 44;
    let passwordDecryptAttempts = 0;
    const maxPasswordAttempts = 100;
    let found = false;
    let lastError = null;

    while (
      headerEndPosTemp < encryptedFileData.length &&
      passwordDecryptAttempts < maxPasswordAttempts
    ) {
      try {
        const encryptedFileKeyData = encryptedFileData.slice(
          16,
          headerEndPosTemp,
        );
        const passwordKek = await deriveKek(password, identifier);
        fileKey = decryptFileKey(encryptedFileKeyData, passwordKek);
        found = true;
        console.log(`找到正确头部长度: ${headerEndPosTemp - 16} 字节`);
        break;
      } catch (e) {
        lastError = e;
        headerEndPosTemp += 1;
        passwordDecryptAttempts += 1;
      }
    }

    if (!found) {
      console.log("尝试使用60字节固定长度...");
      try {
        const encryptedFileKeyData = encryptedFileData.slice(16, 16 + 60);
        const passwordKek = await deriveKek(password, identifier);
        fileKey = decryptFileKey(encryptedFileKeyData, passwordKek);
        headerEndPosTemp = 16 + 60;
        found = true;
      } catch (e) {
        throw new Error("密码解密失败: " + lastError.message);
      }
    }
    headerEndPos = headerEndPosTemp;
  } else {
    throw new Error("请提供密码或vkey文件");
  }

  const customHeaderResult = parseCustomHeader(
    encryptedFileData.slice(headerEndPos),
  );

  if (!customHeaderResult.hashValue) {
    throw new Error("无法解析自定义文件头");
  }

  let originalFileName = "decrypted_file";
  if (customHeaderResult.fileNameBytes) {
    try {
      const fileNameArea = textEncoderDecode(customHeaderResult.fileNameBytes);
      const cleanFileName = fileNameArea.split("\0")[0].trim();
      if (cleanFileName && cleanFileName !== "unnamed_file") {
        try {
          originalFileName = base64Decode(cleanFileName).toString("utf-8");
        } catch (e) {
          originalFileName = cleanFileName;
        }
      }
    } catch (e) {
      console.warn("文件名解码失败，使用默认文件名");
    }
  }

  const contentStartPos = headerEndPos + customHeaderResult.totalLength;
  const encryptedContent = encryptedFileData.slice(contentStartPos);

  process.stdout.write("解密进度: ");
  const decryptedData = await decryptFileChunks(encryptedContent, fileKey);
  console.log("100.00%");

  const decryptedHash = await calculateSha256(decryptedData);
  if (customHeaderResult.hashValue) {
    let hashMatch = true;
    for (let i = 0; i < decryptedHash.length; i++) {
      if (decryptedHash[i] !== customHeaderResult.hashValue[i]) {
        hashMatch = false;
        break;
      }
    }
    if (!hashMatch) {
      console.warn("警告: 文件哈希验证失败");
    } else {
      console.log("文件哈希验证成功");
    }
  }

  const finalOutputPath = outputPath || originalFileName;
  fs.writeFileSync(finalOutputPath, decryptedData);
  console.log(`解密文件已保存: ${finalOutputPath}`);
  console.log("解密完成!");
}

function showHelp() {
  console.log(`
VENC 命令行加密/解密工具

用法:
  node cli.js encrypt <输入文件> <输出文件> <密码> [--name <原始文件名>]
  node cli.js decrypt <输入文件> [输出文件] [-p <密码> | -k <vkey文件>]

命令:
  encrypt, enc, e  加密文件
  decrypt, dec, d  解密文件

加密选项:
  --name, -n <name>  原始文件名（用于解密时恢复文件名）

解密选项:
  --password, -p <password>  解密密码
  --vkey, -k <vkey>          vkey密钥文件路径

示例:
  node cli.js enc myfile.txt myfile.venc "mypassword"
  node cli.js dec myfile.venc -p "mypassword"
  node cli.js dec myfile.venc -k myfile.vkey
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    showHelp();
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  try {
    if (command === "encrypt" || command === "enc" || command === "e") {
      if (args.length < 4) {
        console.error("加密命令需要: 输入文件 输出文件 密码");
        process.exit(1);
      }

      const inputPath = args[1];
      const outputPath = args[2];
      const password = args[3];
      const options = {};

      for (let i = 4; i < args.length; i++) {
        if (args[i] === "--name" || args[i] === "-n") {
          options.originalName = args[i + 1];
          i++;
        }
      }

      await encryptFile(inputPath, outputPath, password, options);
    } else if (command === "decrypt" || command === "dec" || command === "d") {
      if (args.length < 2) {
        console.error("解密命令需要: 输入文件 [输出文件]");
        process.exit(1);
      }

      const inputPath = args[1];
      let outputPath = null;
      let password = null;
      let vkeyPath = null;

      for (let i = 2; i < args.length; i++) {
        if (args[i] === "-p" || args[i] === "--password") {
          password = args[i + 1];
          i++;
        } else if (args[i] === "-k" || args[i] === "--vkey") {
          vkeyPath = args[i + 1];
          i++;
        } else if (!outputPath) {
          outputPath = args[i];
        }
      }

      if (!password && !vkeyPath) {
        console.error("错误: 请提供密码(-p)或vkey文件(-k)");
        process.exit(1);
      }

      await decryptFile(inputPath, outputPath, password, vkeyPath);
    } else if (command === "--help" || command === "-h" || command === "help") {
      showHelp();
    } else {
      console.error(`未知命令: ${command}`);
      showHelp();
      process.exit(1);
    }
  } catch (error) {
    console.error("错误:", error.message);
    process.exit(1);
  }
}

main();
