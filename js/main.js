// 等待DOM加载完成后执行所有代码
// 导入国际化模块
import { initI18n, t, changeLanguage, getCurrentLanguage, getSupportedLanguages, applyTranslations } from './i18n.js';

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
  
  // 初始化配置弹窗
  initConfigModal();
  
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

  // 初始化Web Worker - 提升为全局变量并确保它在所有情况下都能访问
  if (!window.worker || window.worker.terminated) {
    try {
      window.worker = new Worker("js/cryptoWorker.js");
      console.log('Web Worker初始化成功');
    } catch (error) {
      console.error('Web Worker初始化失败:', error);
      // 创建一个模拟worker以避免后续代码崩溃
      window.worker = {
        postMessage: function() { console.warn('Web Worker不可用，操作无法执行'); },
        terminate: function() {},
        terminated: true
      };
    }
  }
  const worker = window.worker;

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

  // 配置弹窗事件处理
function initConfigModal() {
  // 获取配置相关元素
  const testServerConnection = document.getElementById('testServerConnection');
  const apiKey = document.getElementById('apiKey');
  
  // 打开配置弹窗
  configButton.addEventListener('click', () => {
    const config = configManager.loadConfig();
    serverUrl.value = config.serverUrl || '';
    apiKey.value = config.apiKey || '';
    
    // 加载加密设置
    encryptSendFilename.checked = config.encrypt?.sendFilename || false;
    encryptSendFileSize.checked = config.encrypt?.sendFileSize || false;
    encryptSendUUID.checked = config.encrypt?.sendUUID || false;
    encryptSendPassword.checked = config.encrypt?.sendPassword || false;
    useRandomFilename.checked = config.encrypt?.useRandomFilename || false;
    
    // 加载解密设置
    decryptSendFilename.checked = config.decrypt?.sendFilename || false;
    decryptSendFileSize.checked = config.decrypt?.sendFileSize || false;
    decryptSendUUID.checked = config.decrypt?.sendUUID || false;
    decryptSendPassword.checked = config.decrypt?.sendPassword || false;
    
    configModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
    
    // 重新应用翻译到模态框内容，确保所有元素文本都被正确翻译
    applyTranslations();
  });
  
  // 关闭配置弹窗
  function closeModal() {
    configModal.classList.remove('active');
    document.body.style.overflow = ''; // 恢复背景滚动
  }
  
  configModalClose.addEventListener('click', closeModal);
  configModalCancel.addEventListener('click', closeModal);
  
  // 点击模态框外部关闭
  configModal.addEventListener('click', (e) => {
    if (e.target === configModal) {
      closeModal();
    }
  });
  
  // 保存配置
  configModalSave.addEventListener('click', () => {
    const config = {
      serverUrl: serverUrl.value.trim(),
      apiKey: apiKey.value.trim(),
      encrypt: {
        sendFilename: encryptSendFilename.checked,
        sendFileSize: encryptSendFileSize.checked,
        sendUUID: encryptSendUUID.checked,
        sendPassword: encryptSendPassword.checked,
        useRandomFilename: useRandomFilename.checked
      },
      decrypt: {
        sendFilename: decryptSendFilename.checked,
        sendFileSize: decryptSendFileSize.checked,
        sendUUID: decryptSendUUID.checked,
        sendPassword: decryptSendPassword.checked
      }
    };
    
    if (configManager.saveConfig(config)) {
      console.log('配置保存成功');
    }
    
    closeModal();
  });
  
  // 为立即更新PWA按钮添加点击事件
  const configModalUpdate = document.getElementById('configModalUpdate');
  if (configModalUpdate) {
    configModalUpdate.addEventListener('click', async () => {
      if ('serviceWorker' in navigator) {
        try {
          // 显示更新中状态
          const originalText = configModalUpdate.textContent;
          configModalUpdate.disabled = true;
          configModalUpdate.textContent = t('updatingPWA') || '正在更新PWA...';
          
          // 注册更新完成的监听器
          navigator.serviceWorker.addEventListener('controllerchange', function onControllerChange() {
            console.log('PWA已更新，刷新页面获取最新版本...');
            // 更新成功后先显示成功提示，然后再刷新页面
            configModalUpdate.textContent = t('updateToLatestVersion') || '已更新至最新版本';
            setTimeout(() => {
              location.reload();
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            }, 3000);
          });
          
          // 检查是否有等待激活的Service Worker
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            if (registration.waiting) {
              // 向等待的Service Worker发送消息，使其跳过等待状态
              console.log('发现等待激活的Service Worker，请求其跳过等待状态...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else if (registration.installing) {
              // 如果有正在安装的Service Worker，则监听其状态变化
              registration.installing.addEventListener('statechange', function onStateChange() {
                if (registration.waiting) {
                  console.log('Service Worker安装完成，请求其跳过等待状态...');
                  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                  registration.installing.removeEventListener('statechange', onStateChange);
                }
              });
            } else {
              // 没有等待的Service Worker，尝试更新
              console.log('没有发现等待激活的Service Worker，尝试检查更新...');
              await registration.update();
              
              // 等待一段时间后检查是否有新的Service Worker
              setTimeout(async () => {
                const updatedRegistration = await navigator.serviceWorker.getRegistration();
                if (updatedRegistration && updatedRegistration.waiting) {
                  updatedRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  // 没有新的更新可用
                  configModalUpdate.textContent = t('noUpdateAvailable') || '目前已是最新版本';
                  setTimeout(() => {
                    configModalUpdate.disabled = false;
                    configModalUpdate.textContent = originalText;
                  }, 2000);
                }
              }, 10000);
            }
          }
        } catch (error) {
          console.error('PWA更新失败:', error);
          configModalUpdate.textContent = t('updateFailed') || '更新失败';
          setTimeout(() => {
            configModalUpdate.disabled = false;
            configModalUpdate.textContent = t('updatePWA') || '立即更新PWA';
          }, 2000);
        }
      } else {
        console.warn('浏览器不支持Service Worker');
        alert(t('serviceWorkerNotSupported') || '您的浏览器不支持PWA更新功能');
      }
    });
  }
  
  // 添加测试连接按钮的点击事件
  if (testServerConnection) {
    // 获取测试结果显示元素
    const testConnectionResult = document.getElementById('testConnectionResult');
    
    testServerConnection.addEventListener('click', async () => {
      const serverUrlValue = serverUrl.value.trim();
      const apiKeyValue = apiKey.value.trim();
      
      if (!serverUrlValue) {
        showTestResult(false, t('pleaseEnterServerUrl'));
        return;
      }
      
      // 立即保存当前输入的配置用于测试
      const tempConfig = {
        serverUrl: serverUrlValue,
        apiKey: apiKeyValue,
        encrypt: {
          sendFilename: encryptSendFilename.checked,
          sendFileSize: encryptSendFileSize.checked,
          sendUUID: encryptSendUUID.checked,
          sendPassword: encryptSendPassword.checked,
          useRandomFilename: useRandomFilename.checked
        },
        decrypt: {
          sendFilename: decryptSendFilename.checked,
          sendFileSize: decryptSendFileSize.checked,
          sendUUID: decryptSendUUID.checked,
          sendPassword: decryptSendPassword.checked
        }
      };
      
      // 保存临时配置
      configManager.saveConfig(tempConfig);
      
      // 测试连接
      testServerConnection.disabled = true;
      testServerConnection.textContent = t('testingConnection');
      showTestResult(null, t('testingConnection'));
      
      const isConnected = await configManager.testConnection();
      
      testServerConnection.disabled = false;
      testServerConnection.textContent = t('testConnection');
      
      // 显示测试结果
      if (isConnected) {
        showTestResult(true, t('connectionSuccess'));
      } else {
        showTestResult(false, t('connectionFailed'));
      }
    });
    
    // 显示测试结果的辅助函数
    function showTestResult(isSuccess, message) {
      if (!testConnectionResult) return;
      
      // 清除之前的样式和内容
      testConnectionResult.className = 'test-connection-result';
      
      // 根据结果添加相应的样式
      if (isSuccess === null) {
        // 测试中
        testConnectionResult.classList.add('testing');
      } else if (isSuccess) {
        // 成功
        testConnectionResult.classList.add('success');
      } else {
        // 失败
        testConnectionResult.classList.add('error');
      }
      
      // 设置消息内容
      testConnectionResult.textContent = message;
      
      // 3秒后清除结果（除了测试中状态）
      if (isSuccess !== null) {
        setTimeout(() => {
          if (testConnectionResult) {
            testConnectionResult.textContent = '';
            testConnectionResult.className = 'test-connection-result';
          }
        }, 3000);
      }
    }
  }
}

// 语言选择器功能
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
    getSupportedLanguages().forEach(langCode => {
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

  // 配置管理
  const configManager = {
    // 生成UUID的函数
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    
    // 加载配置
    loadConfig() {
      try {
        const config = localStorage.getItem('vencConfig');
        return config ? JSON.parse(config) : this.getDefaultConfig();
      } catch (error) {
        console.error('加载配置失败:', error);
        return this.getDefaultConfig();
      }
    },
    
    // 获取默认配置
    getDefaultConfig() {
      return {
        serverUrl: '',
        apiKey: '',
        encrypt: {
          sendFilename: false,
          sendFileSize: false,
          sendUUID: false,
          sendPassword: false,
          useRandomFilename: false
        },
        decrypt: {
          sendFilename: false,
          sendFileSize: false,
          sendUUID: false,
          sendPassword: false
        }
      };
    },
    
    // 保存配置
    saveConfig(config) {
      try {
        localStorage.setItem('vencConfig', JSON.stringify(config));
        return true;
      } catch (error) {
        console.error('保存配置失败:', error);
        return false;
      }
    },
    
    // 测试服务器连接
    async testConnection() {
      const config = this.loadConfig();
      
      if (!config.serverUrl) {
        console.log('未配置服务器URL，跳过连接测试');
        return false;
      }
      
      const startTime = performance.now();
      console.log(`[连接测试] 开始测试服务器连接: ${config.serverUrl}`);
      
      try {
        // 发送GET请求到health端点
        // 注意：健康检查总是使用根域名的/health路径，而不是在配置的URL后添加/health
        const baseUrl = new URL(config.serverUrl);
        const healthUrl = new URL('/health', baseUrl.origin);
        
        // 构建请求头，包含API Key
        const headers = {};
        
        // 如果配置了API Key，则添加到请求头
        if (config.apiKey) {
          headers['X-API-Key'] = config.apiKey;
        }
        
        const response = await fetch(healthUrl.toString(), {
          method: 'GET',
          headers: headers,
          timeout: 5000 // 5秒超时
        });
        
        const endTime = performance.now();
        
        if (response.ok && await response.text() === 'OK') {
          console.log(`[连接测试] 成功连接到服务器，响应时间: ${(endTime - startTime).toFixed(2)}ms`);
          return true;
        } else {
          console.error(`[连接测试] 服务器连接失败: 状态码 ${response.status}`);
          return false;
        }
      } catch (error) {
        const endTime = performance.now();
        console.error(`[连接测试] 服务器连接异常: ${error.message}，耗时: ${(endTime - startTime).toFixed(2)}ms`);
        return false;
      }
    },

    // 发送数据到服务器
    async sendDataToServer(data, type) {
      const config = this.loadConfig();
      
      if (!config.serverUrl) {
        console.log(`[${type}数据发送] 未配置服务器URL，跳过发送数据`);
        return;
      }
      
      // 先测试连接
      console.log(`[${type}数据发送] 准备发送数据前，先测试服务器连接...`);
      const isConnected = await this.testConnection();
      
      if (!isConnected) {
        console.warn(`[${type}数据发送] 连接测试失败，跳过数据发送`);
        return;
      }
      
      const startTime = performance.now();
      console.log(`[${type}数据发送] 开始发送数据，数据大小: ${new Blob([JSON.stringify(data)]).size} 字节`);
      console.log(`[${type}数据发送] 数据内容摘要:`, {
        filename: data.filename || '未提供',
        size: data.size ? `${(data.size / (1024 * 1024)).toFixed(2)} MB` : '未提供',
        hasPassword: !!data.password,
        hasUUID: !!data.uuid
      });
      
      try {
        // 构建请求头，包含API Key
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // 如果配置了API Key，则添加到请求头
        if (config.apiKey) {
          headers['X-API-Key'] = config.apiKey;
        }
        
        const response = await fetch(config.serverUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data)
        });
        
        const endTime = performance.now();
        
        if (!response.ok) {
          throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log(`[${type}数据发送] 数据发送成功，响应时间: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`[${type}数据发送] 服务器响应:`, responseData);
      } catch (error) {
        const endTime = performance.now();
        console.error(`[${type}数据发送] 数据发送失败:`, error);
        console.error(`[${type}数据发送] 失败详情: 错误类型=${error.name}, 错误消息=${error.message}, 耗时=${(endTime - startTime).toFixed(2)}ms`);
        // 发送失败不影响主流程
      }
    }
  };

  // 页面加载时初始化并清理缓存
    cacheManager.clearAll();

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
        
        // 2. 根据配置发送数据到服务器
        const config = configManager.loadConfig();
        const sendData = {};
        
        if (config.encrypt.sendFilename) {
          sendData.filename = file.name;
        }
        if (config.encrypt.sendFileSize) {
          sendData.size = file.size;
        }
        // 加密时如果开启了UUID发送且开启了使用随机UUID文件名，则发送UUID
        if (config.encrypt.sendUUID && config.encrypt.useRandomFilename) {
          sendData.uuid = configManager.generateUUID();
        }
        if (config.encrypt.sendPassword) {
          sendData.password = password; 
        }
        
        if (Object.keys(sendData).length > 0) {
          // 异步发送数据，不阻塞主流程
          configManager.sendDataToServer(sendData, '加密');
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
        
        // 根据配置发送数据到服务器
        const config = configManager.loadConfig();
        const sendData = {};
        
        if (config.decrypt.sendFilename) {
          sendData.filename = encryptedFile.name;
        }
        if (config.decrypt.sendFileSize) {
          sendData.size = encryptedFile.size;
        }
        // 解密时不需要发送UUID数据
        if (config.decrypt.sendPassword && !isVkeyMode) {
          sendData.password = password; 
        }
        
        if (Object.keys(sendData).length > 0) {
          // 异步发送数据，不阻塞主流程
          configManager.sendDataToServer(sendData, '解密');
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
            // 获取配置
            const config = configManager.loadConfig();
            
            // 移除原始扩展名
            const nameWithoutExtension = 
              originalName.lastIndexOf(".") > 0
                ? originalName.substring(0, originalName.lastIndexOf("."))
                : originalName;
            
            // 根据配置决定是否使用随机UUID文件名
            let encryptedFileNameBase = nameWithoutExtension;
            if (config.encrypt.useRandomFilename) {
              // 使用带连接符的随机UUID作为文件名
              encryptedFileNameBase = configManager.generateUUID();
            }
            
            const encryptedFileName = `${encryptedFileNameBase}.venc`;
            const vkeyFileName = `${encryptedFileNameBase}.vkey`;

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
            // 对于worker错误代码，直接显示错误信息，不添加额外前缀
            if (data.module === "encrypt") {
              encryptStatus.textContent = errorMessage;
              encryptStatus.style.color = "#ff4d4f";
            } else {
              decryptStatus.textContent = errorMessage;
              decryptStatus.style.color = "#ff4d4f";
            }
          } else {
            // 对于非worker错误，添加相应的前缀
            if (data.module === "encrypt") {
              encryptStatus.textContent = t('encryptionFailed') + ': ' + errorMessage;
              encryptStatus.style.color = "#ff4d4f";
            } else {
              decryptStatus.textContent = t('decryptionFailed') + ': ' + errorMessage;
              decryptStatus.style.color = "#ff4d4f";
            }
          }
          // 在控制台输出更详细的错误信息，方便调试
          if (data.stack) {
            console.error(t('workerErrorDetails') + ' ' + data.stack);
          }
          break;
      }
    };
  }

  // 页面卸载时清除缓存，但不立即终止Worker，以便可能的页面刷新能够更平滑
  window.addEventListener("beforeunload", () => {
    // 只清除缓存，不终止Worker，让浏览器自行处理
    cacheManager.clearAll();
  });

  // 自动更新功能实现
  let updateInterval;
  let updateNotificationShown = false;
  
  // 初始化自动更新功能
  function initAutoUpdate() {
    if ('serviceWorker' in navigator) {
      // 页面加载时主动检查Service Worker更新
      registerServiceWorker();
      
      // 设置定期检查更新（每10分钟）
      updateInterval = setInterval(() => {
        checkForUpdates();
      }, 10 * 60 * 1000);
      
      // 在页面可见性变化时也检查更新
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      });
    }
  }
  
  // 注册Service Worker
  function registerServiceWorker() {
    navigator.serviceWorker.register('service-worker.js').then(registration => {
      console.log('Service Worker已注册');
      
      // 监听更新事件
      registration.addEventListener('updatefound', () => {
        console.log('发现新的Service Worker版本');
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              console.log('Service Worker已安装完成');
              if (navigator.serviceWorker.controller) {
                // 有新版本可用
                console.log('检测到新版本');
                showUpdateNotification();
              }
            }
          });
        }
      });
    }).catch(error => {
      console.error('Service Worker注册失败:', error);
    });
    
    // 监听来自Service Worker的消息
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        console.log('收到缓存更新通知');
        showUpdateNotification();
      }
    });
    
    // 页面加载后立即检查是否有等待激活的Service Worker
    navigator.serviceWorker.ready.then(registration => {
      if (registration.waiting) {
        console.log('有等待激活的Service Worker版本');
        showUpdateNotification();
      }
    });
  }
  
  // 检查更新
  function checkForUpdates() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        // 强制检查更新
        registration.update().then(() => {
          console.log('已检查Service Worker更新');
        });
      });
    }
  }
  
  // 显示更新通知UI
  function showUpdateNotification() {
    // 如果已经显示了通知，则不再显示
    if (updateNotificationShown) return;
    
    updateNotificationShown = true;
    
    // 创建更友好的更新通知UI
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <div class="update-icon"><i class="fas fa-sync-alt"></i></div>
        <div class="update-text">
          <h3>${t('newVersionAvailable')}</h3>
          <p>${t('appHasNewVersionDesc')}</p>
        </div>
        <div class="update-actions">
          <button class="update-now">${t('updateNow')}</button>
          <button class="update-later">${t('updateLater')}</button>
        </div>
      </div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      .update-content {
        padding: 20px;
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      
      .update-icon {
        font-size: 24px;
        color: #4CAF50;
        margin-top: 2px;
      }
      
      .update-text h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: #333;
      }
      
      .update-text p {
        margin: 0;
        font-size: 14px;
        color: #666;
        line-height: 1.4;
      }
      
      .update-actions {
        display: flex;
        gap: 10px;
        margin-left: auto;
      }
      
      .update-now,
      .update-later {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .update-now {
        background: #4CAF50;
        color: white;
      }
      
      .update-now:hover {
        background: #45a049;
      }
      
      .update-later {
        background: #f5f5f5;
        color: #666;
      }
      
      .update-later:hover {
        background: #e0e0e0;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // 添加按钮事件
    notification.querySelector('.update-now').addEventListener('click', () => {
      window.location.reload(true); // 强制刷新，忽略缓存
    });
    
    notification.querySelector('.update-later').addEventListener('click', () => {
      notification.remove();
      updateNotificationShown = false;
      
      // 30分钟后再次提示
      setTimeout(() => {
        updateNotificationShown = false;
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.getRegistration().then(registration => {
            if (registration && registration.waiting) {
              showUpdateNotification();
            }
          });
        }
      }, 30 * 60 * 1000);
    });
  }
  
  // 初始化自动更新功能
  initAutoUpdate();

  // 优化重置模块功能，确保Web Worker状态正确重置
  function resetModule(module) {
    // 重置状态显示
    if (module === 'encrypt') {
      encryptFile.value = '';
      encryptPwd.value = '';
      encryptProgress.style.width = '0%';
      encryptStatus.textContent = '';
      encryptStatus.style.color = '';
      
      // 移除下载区域
      const downloadArea = document.getElementById('encrypt-download-area');
      if (downloadArea && downloadArea.parentNode) {
        downloadArea.parentNode.removeChild(downloadArea);
      }
      
      // 显示开始加密按钮
      if (startEncrypt) {
        startEncrypt.style.display = 'inline-block';
      }
    } else {
      decryptFile.value = '';
      vkeyFile.value = '';
      decryptPwd.value = '';
      decryptProgress.style.width = '0%';
      decryptStatus.textContent = '';
      decryptStatus.style.color = '';
      
      // 移除下载按钮
      const decryptDownloadBtn = document.getElementById('decryptDownloadBtn');
      if (decryptDownloadBtn && decryptDownloadBtn.parentNode) {
        decryptDownloadBtn.parentNode.removeChild(decryptDownloadBtn);
      }
      
      // 显示开始解密按钮
      if (startDecrypt) {
        startDecrypt.style.display = 'inline-block';
      }
    }
    
    // 确保Worker状态正确，如果Worker已终止则重新初始化
    if (!window.worker || window.worker.terminated) {
      try {
        window.worker = new Worker('js/cryptoWorker.js');
        console.log('Web Worker已重新初始化');
      } catch (error) {
        console.error('Web Worker重新初始化失败:', error);
      }
    }
    
    // 清理解密相关的缓存
    cacheManager.clearByTag(module);
  }
}); // 结束DOMContentLoaded事件监听器
