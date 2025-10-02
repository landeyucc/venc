/**
 * 国际化支持模块
 * 支持英文、简体中文与繁体中文
 */

// 从单独的语言文件导入翻译
import enUS from '../lang/en-US.js';
import zhCN from '../lang/zh-CN.js';
import zhTW from '../lang/zh-TW.js';

// 语言包定义
const translations = {
  'en-US': enUS,
  'zh-CN': zhCN,
  'zh-TW': zhTW
};

// 当前语言
let currentLang = null;

/**
 * 检测浏览器语言环境
 * @returns {string} 检测到的语言代码
 */
function detectBrowserLanguage() {
  // 获取浏览器首选语言
  const browserLang = navigator.language || navigator.userLanguage;
  
  // 支持的语言列表
  const supportedLangs = ['en-US', 'zh-CN', 'zh-TW'];
  
  // 检查是否有完全匹配的语言
  if (supportedLangs.includes(browserLang)) {
    return browserLang;
  }
  
  // 检查语言前缀匹配
  const langPrefix = browserLang.split('-')[0];
  for (const lang of supportedLangs) {
    if (lang.startsWith(langPrefix)) {
      return lang;
    }
  }
  
  // 默认使用英文
  return 'en-US';
}

/**
 * 初始化国际化
 */
export function initI18n() {
  // 检查本地存储中是否有保存的语言偏好
  const savedLang = localStorage.getItem('venc_language');
  
  // 如果没有保存的语言，检测浏览器语言
  currentLang = savedLang || detectBrowserLanguage();
  
  // 应用翻译
  applyTranslations();
}

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {Object} params - 可选的参数对象，用于格式化文本
 * @returns {string} 翻译后的文本
 */
export function t(key, params = {}) {
  // 如果当前语言未初始化，使用默认语言
  if (!currentLang) {
    currentLang = detectBrowserLanguage();
  }
  
  // 获取翻译文本，如果不存在则返回键名
  let text = translations[currentLang]?.[key] || translations['en-US']?.[key] || key;
  
  // 格式化文本（替换参数）
  Object.keys(params).forEach(paramKey => {
    const placeholder = `{{${paramKey}}}`;
    if (text.includes(placeholder)) {
      text = text.replace(new RegExp(placeholder, 'g'), params[paramKey]);
    }
  });
  
  return text;
}

/**
 * 切换语言
 * @param {string} langCode - 语言代码
 */
export function changeLanguage(langCode) {
  if (translations[langCode]) {
    currentLang = langCode;
    localStorage.setItem('venc_language', langCode);
    applyTranslations();
    return true;
  }
  return false;
}

/**
 * 应用翻译到DOM元素
 */
export function getCurrentLanguage() {
  return currentLang;
}

/**
 * 获取支持的语言列表
 * @returns {Array} 支持的语言代码数组
 */
export function getSupportedLanguages() {
  return Object.keys(translations);
}

/**
 * 应用翻译到DOM元素
 * @returns {void}
 */
export function applyTranslations() {
  // 更新HTML标签的lang属性
  document.documentElement.lang = currentLang;
  
  // 翻译所有带有data-i18n属性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
  
  // 翻译所有带有data-i18n-placeholder属性的元素
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });
  
  // 翻译页面标题
  if (document.getElementById('pageTitle')) {
    document.getElementById('pageTitle').textContent = t('appTitle');
  }
  
  // 确保语言选择器为空，只显示图标
  if (document.getElementById('languageSelector')) {
    document.getElementById('languageSelector').innerHTML = '';
  }
}