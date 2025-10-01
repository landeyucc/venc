// 等待DOM加载完成后执行所有代码
// 导入国际化模块
import { initI18n, t, changeLanguage, getCurrentLanguage, getSupportedLanguages } from './i18n.js';

window.addEventListener("DOMContentLoaded", () => {
  // 初始化国际化
  initI18n();
  
  // 设置文件选择器按钮文本和选择状态显示
  function updateFileInputText() {
    const fileInputs = document.querySelectorAll('.file-input');
    fileInputs.forEach(input => {
      input.setAttribute('data-text', t('selectFile'));
      
      // 更新文件选择状态显示
      const label = input.parentElement.querySelector('.label');
      if (input.files.length > 0) {
        // 如果已选择文件，在label后显示文件名（如果有专门用于显示文件名的元素）
        let fileNameDisplay = input.nextElementSibling;
        if (!fileNameDisplay || !fileNameDisplay.classList.contains('file-name-display')) {
          fileNameDisplay = document.createElement('div');
          fileNameDisplay.className = 'file-name-display';
          input.parentNode.insertBefore(fileNameDisplay, input.nextSibling);
        }
        fileNameDisplay.textContent = input.files[0].name;
      }
    });
  }
  
  // 首次加载时更新
  updateFileInputText();
  
  // 为文件选择器添加文件选择事件监听器
  const fileInputs = document.querySelectorAll('.file-input');
  fileInputs.forEach(input => {
    input.addEventListener('change', function() {
      // 更新文件名显示
      const fileNameDisplay = this.nextElementSibling;
      if (fileNameDisplay && fileNameDisplay.classList.contains('file-name-display')) {
        if (this.files.length > 0) {
          fileNameDisplay.textContent = this.files[0].name;
          fileNameDisplay.classList.add('has-file');
        } else {
          fileNameDisplay.textContent = t('noFileSelected');
          fileNameDisplay.classList.remove('has-file');
        }
      }
    });
    
    // 初始化时触发一次change事件，显示初始状态
    const event = new Event('change');
    input.dispatchEvent(event);
  });
  
  // 为语言切换功能添加钩子，当语言切换时更新文件选择器文本
  const originalChangeLanguage = window.changeLanguage || changeLanguage;
  window.changeLanguage = function(langCode) {
    const result = originalChangeLanguage(langCode);
    updateFileInputText();
    
    // 当语言切换时，更新所有文件选择器的状态显示
    const fileInputs = document.querySelectorAll('.file-input');
    fileInputs.forEach(input => {
      const fileNameDisplay = input.nextElementSibling;
      if (fileNameDisplay && fileNameDisplay.classList.contains('file-name-display')) {
        if (input.files.length === 0) {
          fileNameDisplay.textContent = t('noFileSelected');
        }
      }
    });
    
    return result;
  };

  // 初始化Web Worker
  const worker = new Worker("js/cryptoWorker.js");

  // 深色模式切换
  const themeToggle = document.getElementById("themeToggle");
  
  // 检查本地存储中的主题偏好或系统偏好
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  // 设置初始主题
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    document.body.classList.add("dark-theme");
  }
  
  // 主题切换事件监听
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });

  // 监听系统主题变化
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      const isDark = e.matches;
      if (isDark) {
        document.body.classList.add("dark-theme");
      } else {
        document.body.classList.remove("dark-theme");
      }
    }
  });

  // 语言选择器功能
  const languageSelector = document.getElementById("languageSelector");
  const supportedLanguages = getSupportedLanguages();
  let languagePopup = null;
  
  // 创建语言选择弹窗
  function createLanguagePopup() {
    if (languagePopup) return;
    
    // 创建弹窗容器
    languagePopup = document.createElement("div");
    languagePopup.id = "languagePopup";
    languagePopup.className = "language-popup";
    languagePopup.style.display = "none";
    
    // 创建语言选项
    supportedLanguages.forEach(langCode => {
      const langOption = document.createElement("button");
      langOption.className = "language-option";
      langOption.dataset.lang = langCode;
      
      // 设置语言显示名称
      if (langCode === 'en-US') {
        langOption.textContent = t('languageEnglish');
      } else if (langCode === 'zh-CN') {
        langOption.textContent = t('languageChineseSimplified');
      } else if (langCode === 'zh-TW') {
        langOption.textContent = t('languageChineseTraditional');
      }
      
      // 如果是当前语言，添加活动状态
      if (langCode === getCurrentLanguage()) {
        langOption.classList.add("active");
      }
      
      // 添加点击事件
      langOption.addEventListener("click", () => {
        changeLanguage(langCode);
        closeLanguagePopup();
      });
      
      languagePopup.appendChild(langOption);
    });
    
    // 添加到文档中
    document.body.appendChild(languagePopup);
  }
  
  // 显示语言选择弹窗
  function showLanguagePopup() {
    createLanguagePopup();
    
    // 确保每次显示弹窗时都更新active状态
    if (languagePopup) {
      const currentLang = getCurrentLanguage();
      const langOptions = languagePopup.querySelectorAll('.language-option');
      langOptions.forEach(option => {
        if (option.dataset.lang === currentLang) {
          option.classList.add('active');
        } else {
          option.classList.remove('active');
        }
      });
    }
    
    // 获取语言选择器的位置
    const rect = languageSelector.getBoundingClientRect();
    
    // 设置弹窗位置，从左侧展开
    languagePopup.style.position = "fixed";
    languagePopup.style.bottom = `${rect.bottom}px`;
    languagePopup.style.right = `${window.innerWidth - rect.left}px`;
    languagePopup.style.display = "block";
    
    // 添加点击外部关闭弹窗的事件
    setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 0);
  }
  
  // 关闭语言选择弹窗
  function closeLanguagePopup() {
    if (languagePopup) {
      languagePopup.style.display = "none";
    }
    document.removeEventListener("click", handleOutsideClick);
  }
  
  // 处理点击外部关闭弹窗
  function handleOutsideClick(event) {
    if (languagePopup && 
        !languagePopup.contains(event.target) && 
        event.target !== languageSelector) {
      closeLanguagePopup();
    }
  }
  
  // 添加语言选择器点击事件
  if (languageSelector) {
    languageSelector.addEventListener("click", (event) => {
      event.stopPropagation();
      if (languagePopup && languagePopup.style.display === "block") {
        closeLanguagePopup();
      } else {
        showLanguagePopup();
      }
    });
  }

  // 缓存管理系统
  const cacheManager = {
    // 缓存存储对象
    cache: {},

    // 初始化缓存（页面加载时调用）
    init() {
      this.clearAll();
    },

    // 添加数据到缓存并添加标签
    set(key, data, tags = []) {
      this.cache[key] = {
        data,
        tags,
        timestamp: Date.now(),
      };
    },

    // 从缓存获取数据
    get(key) {
      if (this.cache[key]) {
        return this.cache[key].data;
      }
      return null;
    },

    // 按标签清理缓存
    clearByTag(tag) {
      Object.keys(this.cache).forEach((key) => {
        if (this.cache[key].tags.includes(tag)) {
          delete this.cache[key];
        }
      });
    },

    // 清理所有缓存
    clearAll() {
      this.cache = {};
    },
  };

  // 页面加载时初始化并清理缓存
  cacheManager.init();

  // DOM元素
  // 模式切换
  const encryptModeBtn = document.getElementById("encryptModeBtn");
  const decryptModeBtn = document.getElementById("decryptModeBtn");
  const encryptCard = document.getElementById("encryptCard");
  const decryptCard = document.getElementById("decryptCard");

  // 加密模块
  const encryptFile = document.getElementById("encryptFile");
  const encryptPwd = document.getElementById("encryptPwd");
  const encryptProgress = document.getElementById("encryptProgress");
  const encryptStatus = document.getElementById("encryptStatus");
  const startEncrypt = document.getElementById("startEncrypt");
  const clearEncrypt = document.getElementById("clearEncrypt");

  // 解密模块
  const decryptFile = document.getElementById("decryptFile");
  const vkeyFile = document.getElementById("vkeyFile");
  const decryptPwd = document.getElementById("decryptPwd");
  const decryptProgress = document.getElementById("decryptProgress");
  const decryptStatus = document.getElementById("decryptStatus");
  const startDecrypt = document.getElementById("startDecrypt");
  const clearDecrypt = document.getElementById("clearDecrypt");

  // 解密选项卡元素
  const vkeyOptionBtn = document.getElementById("vkeyOptionBtn");
  const passwordOptionBtn = document.getElementById("passwordOptionBtn");
  const vkeyOptionContent = document.getElementById("vkeyOptionContent");
  const passwordOptionContent = document.getElementById(
    "passwordOptionContent"
  );

  // 切换加密/解密模式
  function switchMode(mode) {
    if (mode === "encrypt") {
      encryptModeBtn.classList.add("active");
      decryptModeBtn.classList.remove("active");
      // 先延迟一小段时间再应用样式，确保动画效果能正常触发
      setTimeout(() => {
        encryptCard.classList.remove("hidden");
        decryptCard.classList.add("hidden");
      }, 10);
    } else {
      encryptModeBtn.classList.remove("active");
      decryptModeBtn.classList.add("active");
      // 先延迟一小段时间再应用样式，确保动画效果能正常触发
      setTimeout(() => {
        encryptCard.classList.add("hidden");
        decryptCard.classList.remove("hidden");
      }, 10);
    }

    // 保存当前模式到localStorage
    localStorage.setItem("venc_mode", mode);
  }

  // 切换解密选项卡
  function switchDecryptOption(option) {
    if (option === "vkey") {
      vkeyOptionBtn.classList.add("active");
      passwordOptionBtn.classList.remove("active");
      // 先延迟一小段时间再应用样式，确保动画效果能正常触发
      setTimeout(() => {
        vkeyOptionContent.classList.add("active");
        passwordOptionContent.classList.remove("active");
      }, 10);
    } else {
      vkeyOptionBtn.classList.remove("active");
      passwordOptionBtn.classList.add("active");
      // 先延迟一小段时间再应用样式，确保动画效果能正常触发
      setTimeout(() => {
        vkeyOptionContent.classList.remove("active");
        passwordOptionContent.classList.add("active");
      }, 10);
    }
  }

  // 模式切换事件监听
  if (encryptModeBtn && decryptModeBtn) {
    // 从localStorage恢复上次的模式设置，如果没有则默认为encrypt
    const savedMode = localStorage.getItem("venc_mode") || "encrypt";
    switchMode(savedMode);

    encryptModeBtn.addEventListener("click", () => switchMode("encrypt"));
    decryptModeBtn.addEventListener("click", () => switchMode("decrypt"));
  }

  // 解密选项卡切换事件监听
  if (vkeyOptionBtn && passwordOptionBtn) {
    vkeyOptionBtn.addEventListener("click", () => switchDecryptOption("vkey"));
    passwordOptionBtn.addEventListener("click", () =>
      switchDecryptOption("password")
    );
  }

  // 工具函数：读取文件为Uint8Array
  function readFileAsArrayBuffer(file) {
    // 生成缓存键（基于文件名、大小和最后修改时间）
    const cacheKey = `file_${file.name}_${file.size}_${file.lastModified}`;

    // 检查缓存中是否已有文件数据
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }

    // 缓存未命中，读取文件
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = new Uint8Array(reader.result);
        // 将文件数据存入缓存，并添加'file'标签
        cacheManager.set(cacheKey, fileData, ["file"]);
        resolve(fileData);
      };
      reader.onerror = () => reject(new Error(t('fileReadFailed')));
      reader.readAsArrayBuffer(file);
    });
  }

  // 获取文件扩展名的辅助函数
  function getFileExtension(filename) {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex > 0) {
      return filename.substring(lastDotIndex).toLowerCase();
    }
    return "";
  }

  // 工具函数：下载文件
  function downloadFile(data, fileName, mimeType = "application/octet-stream") {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // 清除Blob缓存

    // 文件生成完成后，清理相关缓存
    // 这里可以根据需要添加特定的缓存清理逻辑
  }

  // 工具函数：重置模块状态
  function resetModule(module) {
    if (module === "encrypt") {
      encryptFile.value = "";
      encryptPwd.value = "";
      encryptProgress.style.width = "0%";
      encryptStatus.textContent = "";
      encryptStatus.style.color = "var(--primary)";
      // 恢复加密按钮显示
      if (startEncrypt) {
        startEncrypt.style.display = "";
      }
      // 移除下载区域
      const encryptDownloadArea = document.getElementById(
        "encrypt-download-area"
      );
      if (encryptDownloadArea && document.getElementById("encryptCard")) {
        document.getElementById("encryptCard").removeChild(encryptDownloadArea);
      }
      // 清理加密相关的缓存
      cacheManager.clearByTag("encrypt");
    } else {
      decryptFile.value = "";
      vkeyFile.value = "";
      decryptPwd.value = "";
      decryptProgress.style.width = "0%";
      decryptStatus.textContent = "";
      decryptStatus.style.color = "var(--primary)";
      // 恢复解密按钮显示
      if (startDecrypt) {
        startDecrypt.style.display = "";
      }
      // 移除下载按钮
      const decryptDownloadBtn = document.getElementById("decryptDownloadBtn");
      if (decryptDownloadBtn && decryptDownloadBtn.parentNode) {
        decryptDownloadBtn.parentNode.removeChild(decryptDownloadBtn);
      }
      // 移除旧的下载区域（为了兼容性）
      const decryptDownloadArea = document.getElementById(
        "decrypt-download-area"
      );
      if (decryptDownloadArea && document.getElementById("decryptCard")) {
        document.getElementById("decryptCard").removeChild(decryptDownloadArea);
      }
      // 清理解密相关的缓存
      cacheManager.clearByTag("decrypt");
    }
    // 清理所有缓存
    cacheManager.clearAll();
  }
  
  // 添加语言选择弹窗的样式
  function addLanguagePopupStyles() {
    const styleId = "languagePopupStyles";
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .language-popup {
        background-color: var(--bg-main);
        border-radius: var(--radius);
        box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        padding: 8px;
        z-index: 1002;
        bottom: 20px !important;
        right: 80px !important;
        min-width: 120px;
        transform-origin: bottom right;
        transform: translateX(100%);
        opacity: 0;
        animation: slideInLeft 0.3s ease forwards;
      }
      
      @keyframes slideInLeft {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      .language-option {
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: transparent;
        border-radius: 8px;
        color: var(--text-main);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition);
        text-align: left;
      }
      
      .language-option:hover {
        background-color: rgba(108, 99, 255, 0.1);
      }
      
      .language-option.active {
        background: linear-gradient(145deg, #7c74ff, #5a52e0);
        color: white;
        box-shadow: inset 2px 2px 4px rgba(0, 0, 0, 0.1), inset -2px -2px 4px rgba(255, 255, 255, 0.1);
      }
    `;
    document.head.appendChild(style);
  }
  
  // 初始化语言选择弹窗样式
  addLanguagePopupStyles();

  // 加密逻辑
  if (startEncrypt) {
    startEncrypt.addEventListener("click", async () => {
      try {
        // 1. 验证输入
        const file = encryptFile.files[0];
        const password = encryptPwd.value.trim();

        if (!file) {
          throw new Error(t('pleaseSelectFile'));
        }
        if (password.length < 4) {
          throw new Error(t('passwordTooShort'));
        }
        // 添加文件大小限制检查（2GB）
        const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
        if (file.size > maxSize) {
          throw new Error(t('fileTooLarge'));
        }

        // 2. 初始化状态
        encryptStatus.textContent = t('preparingToReadFile');
        encryptProgress.style.width = "0%";

        // 3. 读取文件 - 第一个阶段从0%到100%
        encryptStatus.textContent = t('readingFile') + ' 0%';
        encryptProgress.style.width = "0%";

        // 模拟读取进度
        let readProgress = 0;
        const readInterval = setInterval(() => {
          readProgress += 5;
          if (readProgress >= 100) {
            clearInterval(readInterval);
          } else {
            encryptProgress.style.width = `${readProgress}%`;
            encryptStatus.textContent = t('readingFile') + ' ' + readProgress + '%';
          }
        }, 50);

        const fileData = await readFileAsArrayBuffer(file);

        // 确保读取阶段完成
        clearInterval(readInterval);
        encryptProgress.style.width = "100%";
        encryptStatus.textContent = t('fileReadComplete') + ' 100%';

        // 短暂延迟后进入下一阶段
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 4. 初始化加密 - 第二个阶段从0%到100%
        encryptProgress.style.width = "0%";
        encryptStatus.textContent = t('initializingEncryption') + ' 0%';

        // 模拟初始化进度
        let initProgress = 0;
        const initInterval = setInterval(() => {
          initProgress += 10;
          if (initProgress >= 100) {
            clearInterval(initInterval);
          } else {
            encryptProgress.style.width = `${initProgress}%`;
            encryptStatus.textContent = t('initializingEncryption') + ' ' + initProgress + '%';
          }
        }, 30);

        // 短暂延迟模拟初始化过程
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 确保初始化阶段完成
        clearInterval(initInterval);
        encryptProgress.style.width = "100%";
        encryptStatus.textContent = t('encryptionInitialized') + ' 100%';

        // 短暂延迟后进入下一阶段
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 5. 发送到Worker加密 - 第三个阶段将由Worker返回进度
        encryptProgress.style.width = "0%";
        encryptStatus.textContent = t('startEncryptingData') + ' 0%';

        worker.postMessage({
          type: "ENCRYPT",
          data: { fileData, password, fileName: file.name },
        });
      } catch (error) {
        encryptStatus.textContent = error.message;
        encryptStatus.style.color = "#ff4d4f";
      }
    });
  }

  // 解密按钮点击事件
  if (startDecrypt) {
    startDecrypt.addEventListener("click", async () => {
      try {
        // 重置状态
        decryptStatus.textContent = "";
        decryptStatus.style.color = "";
        decryptProgress.style.width = "0%";

        // 获取当前激活的解密选项卡
        const isVkeyMode = vkeyOptionBtn.classList.contains("active");

        const encryptedFile = decryptFile.files[0];
        const vkeyFileObj = vkeyFile.files[0];
        const password = decryptPwd.value.trim();

        if (!encryptedFile) throw new Error(t('pleaseSelectEncryptedFile'));

        // 根据当前激活的选项卡进行验证
        if (isVkeyMode) {
          // 使用恢复密钥模式
          if (!vkeyFileObj) {
            throw new Error(t('pleaseSelectKeyFile'));
          }
          if (!vkeyFileObj.name.endsWith(".vkey")) {
            throw new Error(t('keyFileMustBeVkeyFormat'));
          }
        } else {
          // 使用密码模式
          if (!password) {
            throw new Error(t('pleaseEnterDecryptionPassword'));
          }
        }

        // 2. 初始化状态
        decryptStatus.textContent = t('preparingToReadFile');
        decryptProgress.style.width = "0%";

        // 3. 读取文件 - 第一个阶段从0%到100%
        decryptStatus.textContent = t('readingFile') + ' 0%';
        decryptProgress.style.width = "0%";

        // 模拟读取进度
        let readProgress = 0;
        const readInterval = setInterval(() => {
          readProgress += 5;
          if (readProgress >= 100) {
            clearInterval(readInterval);
          } else {
            decryptProgress.style.width = `${readProgress}%`;
            decryptStatus.textContent = t('readingFile') + ' ' + readProgress + '%';
          }
        }, 50);

        const encryptedFileData = await readFileAsArrayBuffer(encryptedFile);

        // 确保读取阶段完成
        clearInterval(readInterval);
        decryptProgress.style.width = "100%";
        decryptStatus.textContent = t('fileReadComplete') + ' 100%';

        // 短暂延迟后进入下一阶段
        await new Promise((resolve) => setTimeout(resolve, 500));

        let vkeyBase64 = null;

        if (isVkeyMode) {
          // 使用vkey文件时 - 第二个阶段从0%到100%
          decryptProgress.style.width = "0%";
          decryptStatus.textContent = t('recoveringKeyWithVkey') + ' 0%';

          // 模拟vkey文件处理进度
          let vkeyProgress = 0;
          const vkeyInterval = setInterval(() => {
            vkeyProgress += 10;
            if (vkeyProgress >= 100) {
              clearInterval(vkeyInterval);
            } else {
              decryptProgress.style.width = `${vkeyProgress}%`;
              decryptStatus.textContent = t('recoveringKeyWithVkey') + ' ' + vkeyProgress + '%';
            }
          }, 30);

          const vkeyData = await readFileAsArrayBuffer(vkeyFileObj);
          vkeyBase64 = btoa(String.fromCharCode(...vkeyData)); // 转为Base64传给Worker

          // 确保vkey处理阶段完成
          clearInterval(vkeyInterval);
          decryptProgress.style.width = "100%";
          decryptStatus.textContent = t('keyRecovered') + ' 100%';

          // 短暂延迟后进入下一阶段
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          // 只使用密码时 - 第二个阶段从0%到100%
          decryptProgress.style.width = "0%";
          decryptStatus.textContent = t('initializingDecryption') + ' 0%';

          // 模拟初始化进度
          let initProgress = 0;
          const initInterval = setInterval(() => {
            initProgress += 10;
            if (initProgress >= 100) {
              clearInterval(initInterval);
            } else {
              decryptProgress.style.width = `${initProgress}%`;
              decryptStatus.textContent = t('initializingDecryption') + ' ' + initProgress + '%';
            }
          }, 30);

          // 短暂延迟模拟初始化过程
          await new Promise((resolve) => setTimeout(resolve, 300));

          // 确保初始化阶段完成
          clearInterval(initInterval);
          decryptProgress.style.width = "100%";
          decryptStatus.textContent = t('decryptionInitialized') + ' 100%';

          // 短暂延迟后进入下一阶段
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // 4. 发送到Worker解密 - 第三个阶段将由Worker返回进度
        decryptProgress.style.width = "0%";
        decryptStatus.textContent = t('startDecryptingData') + ' 0%';

        // 提取文件扩展名
        let fileExtension = "";
        if (encryptedFile && encryptedFile.name) {
          fileExtension = getFileExtension(encryptedFile.name);
        }

        worker.postMessage({
          type: "DECRYPT",
          data: { encryptedFileData, vkeyBase64, password, fileExtension },
        });
      } catch (error) {
        decryptStatus.textContent = error.message;
        decryptStatus.style.color = "#ff4d4f";
      }
    });
  }

  // 清空按钮事件
  if (clearEncrypt && clearDecrypt) {
    clearEncrypt.addEventListener("click", () => resetModule("encrypt"));
    clearDecrypt.addEventListener("click", () => resetModule("decrypt"));
  }

  // Worker消息处理
  if (worker) {
    worker.onmessage = (e) => {
      const { type, data } = e.data;
      switch (type) {
        case "PROGRESS":
          // 更新进度，格式化为两位小数
          const formattedPercent = data.percent.toFixed(2);
          if (data.module === "encrypt") {
            encryptProgress.style.width = `${formattedPercent}%`;
            // 根据当前阶段显示不同的状态文本
            const statusText =
              data.stage === "merging"
                ? t('mergingFiles') + ' ' + formattedPercent + '%'
                : t('encrypting') + ' ' + formattedPercent + '%';
            encryptStatus.textContent = statusText;
          } else {
            decryptProgress.style.width = `${formattedPercent}%`;
            // 为解密过程也添加阶段判断
            const decryptStatusText =
              data.stage === "merging"
                ? t('mergingFiles') + ' ' + formattedPercent + '%'
                : t('decrypting') + ' ' + formattedPercent + '%';
            decryptStatus.textContent = decryptStatusText;
          }
          break;

        case "SUCCESS":
          if (data.module === "encrypt") {
            // 加密成功：创建下载按钮和提示
            const originalName = encryptFile.files[0].name;
            // 移除原始扩展名，添加.venc扩展名
            const nameWithoutExtension =
              originalName.lastIndexOf(".") > 0
                ? originalName.substring(0, originalName.lastIndexOf("."))
                : originalName;
            const encryptedFileName = `${nameWithoutExtension}.venc`;
            const vkeyFileName = `${nameWithoutExtension}.vkey`;

            // 保存文件数据供按钮点击时使用
            const encryptedFileData = data.encryptedFileData;
            const vkeyData = Uint8Array.from(atob(data.vkeyBase64), (c) =>
              c.charCodeAt(0)
            );

            // 隐藏加密按钮，显示下载提示和按钮
            startEncrypt.style.display = "none";
            encryptStatus.textContent =
              t('encryptionSuccess') + ' ' + t('clickDownloadButton');
            encryptStatus.style.color = "#52c41a";

            // 创建下载区域
            let downloadArea = document.getElementById("encrypt-download-area");
            if (!downloadArea) {
              downloadArea = document.createElement("div");
              downloadArea.id = "encrypt-download-area";
              downloadArea.className = "download-area";
              document.getElementById("encryptCard").appendChild(downloadArea);
            }
            downloadArea.innerHTML = "";

            // 创建加密文件下载按钮
            const encDownloadBtn = document.createElement("button");
            encDownloadBtn.className = "btn btn-primary download-btn";
            encDownloadBtn.textContent = t('downloadEncryptedFile') + ` (${encryptedFileName})`;
            encDownloadBtn.addEventListener("click", () => {
              downloadFile(encryptedFileData, encryptedFileName);
            });

            // 创建vkey文件下载按钮
            const vkeyDownloadBtn = document.createElement("button");
            vkeyDownloadBtn.className = "btn btn-secondary download-btn";
            vkeyDownloadBtn.textContent = t('downloadKeyFile') + ` (${vkeyFileName})`;
            vkeyDownloadBtn.addEventListener("click", () => {
              downloadFile(vkeyData, vkeyFileName, "application/x-vkey");
            });

            downloadArea.appendChild(encDownloadBtn);
            downloadArea.appendChild(vkeyDownloadBtn);

            // 为按钮添加样式
            const style = document.createElement("style");
            style.textContent = `
            .download-area { margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; }
            .download-btn { padding: 8px 16px; cursor: pointer; border: none; border-radius: 4px; color: white; }
            .btn-primary { background-color: #1890ff; }
            .btn-secondary { background-color: #6c757d; }
            .btn-primary:hover { background-color: #40a9ff; }
            .btn-secondary:hover { background-color: #5a6268; }
          `;
            document.head.appendChild(style);
          } else {
            // 解密成功：创建下载按钮和提示
            const decryptedFileData = data.decryptedFileData;
            const originalFileName = data.originalFileName;
            const hashMatch = data.hashMatch;

            // 根据哈希验证结果设置状态文本
            if (!hashMatch) {
              decryptStatus.textContent = 
                t('decryptionComplete') + ' ' + t('integrityCheckFailed');
              decryptStatus.style.color = "#faad14"; // 使用警告色
            } else {
              decryptStatus.textContent = 
                t('decryptionSuccess') + ' ' + t('clickDownloadButton');
              decryptStatus.style.color = "#52c41a";
            }

            // 使用从文件头读取的完整原始文件名
            const finalFileName = originalFileName || "decrypted_file";

            // 获取解密按钮组
            const decryptBtnGroup = document.querySelector('#decryptCard .btn-group');
            
            // 隐藏开始解密按钮
            startDecrypt.style.display = "none";
            
            // 创建下载按钮
            const downloadBtn = document.createElement("button");
            downloadBtn.id = "decryptDownloadBtn";
            downloadBtn.className = "btn btn-primary";
            downloadBtn.innerHTML = '<span class="icon icon-primary"></span> ' + t('downloadDecryptedFile');
            downloadBtn.addEventListener("click", () => {
              downloadFile(decryptedFileData, finalFileName);
            });
            
            // 在重置按钮前插入下载按钮
            decryptBtnGroup.insertBefore(downloadBtn, clearDecrypt);
            
            // 确保按钮平均分布宽度
            const buttons = decryptBtnGroup.querySelectorAll('button');
            buttons.forEach(btn => {
              btn.style.flex = '1';
            });
          }
          break;

        case "ERROR":
          // 错误处理
          // 检查是否是worker错误代码（以workerError开头）
          let errorMessage = data.message;
          if (errorMessage.startsWith('workerError')) {
            errorMessage = t(errorMessage);
          }
          
          if (data.module === "encrypt") {
            encryptStatus.textContent = t('encryptionFailed') + ': ' + errorMessage;
            encryptStatus.style.color = "#ff4d4f";
          } else {
            decryptStatus.textContent = t('decryptionFailed') + ': ' + errorMessage;
            decryptStatus.style.color = "#ff4d4f";
          }
          // 在控制台输出更详细的错误信息，方便调试
          if (data.stack) {
            console.error(t('workerErrorDetails') + ' ' + data.stack);
          }
          break;
      }
    };
  }

  // 页面卸载时终止Worker，清除缓存
  window.addEventListener("beforeunload", () => {
    worker.terminate();
    // 页面卸载前清理所有缓存
    cacheManager.clearAll();
  });
}); // 结束DOMContentLoaded事件监听器
