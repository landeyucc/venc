// Cloudflare Worker KV 后端接收系统

// 环境变量中的密码
const ADMIN_PASSWORD = ENV_ADMIN_PASSWORD || 'default_password'; // 实际部署时通过环境变量设置

// 环境变量中的API身份秘钥
const API_KEY = ENV_API_KEY || 'default_api_key'; // 实际部署时通过环境变量设置

// KV 命名空间绑定
const VENC_KV_NAMESPACE = KV_NAMESPACE; // 在 Cloudflare Dashboard 中绑定

// 验证请求头是否为 JSON
function validateRequest(request) {
  const contentType = request.headers.get('Content-Type');
  return contentType && contentType.includes('application/json');
}

// 验证管理员密码
function authenticate(password) {
  return password === ADMIN_PASSWORD;
}

// 验证API身份秘钥
function validateApiKey(request) {
  const apiKey = request.headers.get('X-API-Key');
  return apiKey && apiKey === API_KEY;
}

// 格式化文件大小（自动选择MB或GB单位）
function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null) return '';
  const mb = bytes / (1024 * 1024);
  const gb = bytes / (1024 * 1024 * 1024);
  
  // 如果小于1GB则显示MB，否则显示GB，所有大小都保留两位小数
  if (gb < 1) {
    return mb.toFixed(2) + ' MB';
  } else {
    return gb.toFixed(2) + ' GB';
  }
}

// 从文件名提取 Designation 和 File_Name
function parseFileName(filename) {
  if (!filename) return { designation: '', file_name: '' };
  
  // 匹配 任意字符+连接符-+数字+可选空格+剩余部分
  const regex = /^([^-]+-\d+)(\s+.*)?$/;
  const match = filename.match(regex);
  
  if (match) {
    return {
      designation: match[1],
      file_name: match[2] ? match[2].trim() : ''
    };
  } else {
    return {
      designation: '',
      file_name: filename
    };
  }
}

// 生成下一个序列号 - 现在通过查询所有条目自动递增
async function generateNextNum() {
  try {
    const list = await VENC_KV_NAMESPACE.list({ prefix: 'ENTRY_' });
    
    if (list.keys.length === 0) {
      return 1; // 如果没有条目，从1开始
    }
    
    // 提取所有条目的Num并找出最大值
    let maxNum = 0;
    for (const key of list.keys) {
      // 从键名中提取Num值（格式为ENTRY_数字）
      const numMatch = key.name.match(/^ENTRY_(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        maxNum = Math.max(maxNum, num);
      }
    }
    
    return maxNum + 1;
  } catch (error) {
    console.error('生成序列号失败:', error);
    return Date.now(); // 失败时使用时间戳作为后备
  }
}

// 生成北京时间字符串，格式为000000[年取两位月与日]00:00
function generateBeijingTime() {
  // 创建当前时间对象
  const now = new Date();
  
  // 转换为北京时间（UTC+8）
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  
  const year = beijingTime.getUTCFullYear().toString().substr(2); // 取年份后两位
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getUTCDate()).padStart(2, '0');
  const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
  const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
  
  // 格式为[年取两位月与日]00:00
  return `${year}${month}${day}-${hours}:${minutes}`;
}

// 处理加密/解密请求
async function handleApiRequest(data) {
  try {
    // 生成序列号
    const num = await generateNextNum();
    
    // 解析文件名
    const { designation, file_name } = parseFileName(data.filename);
    
    // 构建 KV 数据对象
      const kvData = {
        Num: num,
        Cloud_Path: data.cloud_path || 'OTTC', // 默认值
        Designation: designation,
        ENC_Algorithm: 'VENC-AES-GCM256bit',
        ENC_ID: data.uuid || '',
        File_Name: file_name,
        File_Size: data.size ? formatFileSize(data.size) : '',
        Password: data.password || '',
        Type: 'TAV', // 默认值
        Tag: '', // 默认留空
        Time: generateBeijingTime() // 添加北京时间
      };
    
    // 保存到 KV，使用序列号作为键
    const kvKey = `ENTRY_${num}`;
    await VENC_KV_NAMESPACE.put(kvKey, JSON.stringify(kvData));
    
    return {
      success: true,
      message: '数据保存成功',
      entry: kvData
    };
  } catch (error) {
    console.error('处理请求失败:', error);
    return {
      success: false,
      message: '数据保存失败',
      error: error.message
    };
  }
}

// 获取所有 KV 条目
async function getAllEntries() {
  try {
    const list = await VENC_KV_NAMESPACE.list({
      prefix: 'ENTRY_'
    });
    
    const entries = [];
    for (const key of list.keys) {
      const value = await VENC_KV_NAMESPACE.get(key.name, { type: 'json' });
      if (value) {
        entries.push({
          key: key.name,
          ...value
        });
      }
    }
    
    // 按时间排序（最新的在前）
    entries.sort((a, b) => {
      // 如果没有Time字段，按Num排序作为后备
      if (!a.Time) return 1;
      if (!b.Time) return -1;
      return b.Time.localeCompare(a.Time);
    });
    
    return entries;
  } catch (error) {
    console.error('获取所有条目失败:', error);
    return [];
  }
}

// 获取单个 KV 条目
async function getEntry(key) {
  try {
    const value = await VENC_KV_NAMESPACE.get(key, { type: 'json' });
    return value || null;
  } catch (error) {
    console.error('获取条目失败:', error);
    return null;
  }
}

// 更新 KV 条目
async function updateEntry(key, data) {
  try {
    await VENC_KV_NAMESPACE.put(key, JSON.stringify(data));
    return { success: true, message: '更新成功' };
  } catch (error) {
    console.error('更新条目失败:', error);
    return { success: false, message: '更新失败', error: error.message };
  }
}

// 创建新的 KV 条目
async function createNewEntry(data) {
  try {
    // 生成序列号
    const num = await generateNextNum();
    
    // 构建新条目
    const newEntry = {
      Num: num,
      Cloud_Path: data.Cloud_Path || 'OTTC',
      Designation: data.Designation || '',
      ENC_Algorithm: 'VENC-AES-GCM256bit',
      ENC_ID: data.ENC_ID || '',
      File_Name: data.File_Name || '',
      File_Size: data.File_Size || '',
      Password: data.Password || '',
      Type: 'TAV',
      Tag: data.Tag || '',
      Time: generateBeijingTime() // 添加北京时间
    };
    
    // 保存到 KV
    const kvKey = `ENTRY_${num}`;
    await VENC_KV_NAMESPACE.put(kvKey, JSON.stringify(newEntry));
    
    return { success: true, message: '创建成功', entry: newEntry, key: kvKey };
  } catch (error) {
    console.error('创建条目失败:', error);
    return { success: false, message: '创建失败', error: error.message };
  }
}

// 生成管理界面 HTML
function generateAdminInterface() {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VENC - List</title>
      <link rel="icon" href="https://venc.vl-x.vip/img/venc.ico" type="image/x-icon">
      <style>
        /* 拟态UI变量 */
        :root {
          --bg-main: #e0e5ec;
          --text-main: #4a4a6a;
          --primary: #6c63ff;
          --shadow-dark: rgba(163, 177, 198, 0.6);
          --shadow-light: rgba(255, 255, 255, 0.8);
          --radius: 16px;
          --padding: 24px;
          --transition: all 0.3s ease;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        }

        body {
          min-height: 100vh;
          background-color: var(--bg-main);
          color: var(--text-main);
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .container {
          width: 100%;
          max-width: 1200px;
          min-height: 600px;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-main);
          border-radius: var(--radius);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          overflow: hidden;
          padding: 40px;
        }

        h1 {
          font-size: 32px;
          font-weight: 600;
          text-shadow: 1px 1px 2px var(--shadow-light), -1px -1px 2px var(--shadow-dark);
          text-align: center;
          margin-bottom: 40px;
        }

        h2 {
          font-size: 24px;
          font-weight: 500;
          margin-bottom: 20px;
          text-shadow: 1px 1px 2px var(--shadow-light), -1px -1px 2px var(--shadow-dark);
        }

        h3 {
          font-size: 20px;
          font-weight: 500;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(163, 177, 198, 0.3);
        }

        /* 登录表单样式 */
        .login-form {
          max-width: 400px;
          margin: 50px auto;
          padding: var(--padding);
          background-color: var(--bg-main);
          border-radius: var(--radius);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .login-form input {
          width: 100%;
          padding: 14px 18px;
          margin: 10px 0;
          border: none;
          border-radius: 12px;
          background-color: var(--bg-main);
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          font-size: 16px;
          color: var(--text-main);
          transition: var(--transition);
        }

        .login-form input:focus {
          outline: none;
          box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light), 0 0 0 2px rgba(108, 99, 255, 0.3);
        }

        /* 按钮通用样式 */
        button {
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(145deg, var(--shadow-light), var(--shadow-dark));
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
          font-size: 16px;
          font-weight: 500;
          color: var(--text-main);
          cursor: pointer;
          transition: var(--transition);
          outline: none;
        }

        button:hover {
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          transform: translateY(-2px);
        }

        button:active {
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          transform: translateY(0);
        }

        /* 主色调按钮 */
        .btn-primary {
          background: linear-gradient(145deg, #7c74ff, #5a52e0);
          color: white;
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
        }

        .btn-primary:hover {
          background: linear-gradient(145deg, #8b83ff, #645ce6);
        }

        /* 危险按钮 */
        .btn-danger {
          background: linear-gradient(145deg, #ff7c7c, #e05a5a);
          color: white;
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
        }

        .btn-danger:hover {
          background: linear-gradient(145deg, #ff8b8b, #e66464);
        }

        /* 普通按钮 */
        .edit-btn, .cancel-btn {
          background: linear-gradient(145deg, #f0f0f0, #d1d1d1);
          color: var(--text-primary);
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
        }

        .edit-btn:hover, .cancel-btn:hover {
          background: linear-gradient(145deg, #f9f9f9, #dbdbdb);
        }

        /* 表格内按钮样式 */
        .edit-btn, .delete-btn, .save-btn, .cancel-btn {
          padding: 6px 12px;
          font-size: 14px;
          margin-right: 8px;
        }

        /* 工具栏样式 */
        .toolbar {
          margin-bottom: 30px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* 隐藏元素 */
        .hidden {
          display: none;
        }
        
        /* 搜索框样式 */
        .search-container {
          display: flex;
          align-items: center;
          margin-left: auto;
          margin-right: 10px;
          gap: 8px;
        }
        
        #search-input {
          padding: 10px 16px;
          border: none;
          border-radius: 12px 0 0 12px;
          width: 200px;
          font-size: 14px;
          color: var(--text-main);
          background-color: var(--bg-main);
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          transition: var(--transition);
        }
        
        #search-input:focus {
          outline: none;
          box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light), 0 0 0 2px rgba(108, 99, 255, 0.3);
        }
        
        #search-button {
          padding: 10px 16px;
          border: none;
          border-radius: 0 12px 12px 0;
          background: linear-gradient(145deg, var(--shadow-light), var(--shadow-dark));
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
          font-size: 14px;
          font-weight: 500;
          color: var(--text-main);
          cursor: pointer;
          transition: var(--transition);
          outline: none;
        }
        
        #search-button:hover {
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          transform: translateY(-1px);
        }
        
        #search-button:active {
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          transform: translateY(0);
        }
        
        #clear-search-button {
          padding: 10px 14px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(145deg, var(--shadow-light), var(--shadow-dark));
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
          font-size: 14px;
          font-weight: 500;
          color: var(--text-main);
          cursor: pointer;
          transition: var(--transition);
          outline: none;
        }
        
        #clear-search-button:hover {
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          transform: translateY(-1px);
        }
        
        #clear-search-button:active {
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          transform: translateY(0);
        }

        /* 表格容器样式 */
        .table-container {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          margin-bottom: 20px;
        }

        /* 表格样式 */
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          background-color: var(--bg-main);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          white-space: nowrap;
        }

        th, td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid rgba(163, 177, 198, 0.1);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        th {
          background-color: rgba(108, 99, 255, 0.05);
          font-weight: 600;
          color: var(--primary);
          position: sticky;
          top: 0;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover {
          background-color: rgba(108, 99, 255, 0.05);
        }

        /* 编辑表单样式 */
        .edit-form {
          margin-top: 30px;
          padding: var(--padding);
          background-color: var(--bg-main);
          border-radius: var(--radius);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .form-group {
          margin-bottom: 22px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 15px;
          font-weight: 500;
        }

        .form-group input, .form-group select {
          width: 100%;
          padding: 14px 18px;
          border: none;
          border-radius: 12px;
          background-color: var(--bg-main);
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          font-size: 16px;
          color: var(--text-main);
          transition: var(--transition);
        }

        .form-group input:focus, .form-group select:focus {
          outline: none;
          box-shadow: inset 5px 5px 10px var(--shadow-dark), inset -5px -5px 10px var(--shadow-light), 0 0 0 2px rgba(108, 99, 255, 0.3);
        }

        .form-group input[readonly] {
          background-color: rgba(163, 177, 198, 0.1);
          cursor: not-allowed;
        }

        /* 密码验证对话框样式 */
        .password-dialog {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .password-dialog-content {
          background-color: var(--bg-main);
          padding: 30px;
          border-radius: var(--radius);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          width: 100%;
          max-width: 400px;
        }

        .password-dialog-content h3 {
          margin-bottom: 20px;
        }

        .password-dialog-content input {
          width: 100%;
          padding: 14px 18px;
          margin-bottom: 20px;
          border: none;
          border-radius: 12px;
          background-color: var(--bg-main);
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
          font-size: 16px;
          color: var(--text-main);
        }

        .password-dialog-buttons {
          display: flex;
          gap: 16px;
          justify-content: flex-end;
        }

        /* 按钮组样式 */
        .btn-group {
          display: flex;
          gap: 16px;
          margin-top: 20px;
        }

        /* 消息提示样式 */
        .success-message {
          color: #4CAF50;
          margin-top: 10px;
          padding: 10px 15px;
          background-color: rgba(76, 175, 80, 0.1);
          border-radius: 8px;
          text-align: center;
        }

        .error-message {
          color: #f44336;
          margin-top: 10px;
          padding: 10px 15px;
          background-color: rgba(244, 67, 54, 0.1);
          border-radius: 8px;
          text-align: center;
        }

        /* 排序样式 */
        .sortable {
          cursor: pointer;
          user-select: none;
          position: relative;
          padding-right: 25px !important;
        }
        
        .sort-icon {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 12px;
          color: var(--text-secondary);
        }
        
        .sort-icon.asc::after {
          content: '↑';
          color: var(--primary);
        }
        
        .sort-icon.desc::after {
          content: '↓';
          color: var(--primary);
        }
        
        /* 行内编辑样式 */
        .edit-field input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid var(--primary);
          border-radius: 4px;
          background-color: rgba(108, 99, 255, 0.05);
        }
        
        .hidden {
          display: none;
        }
        @media (max-width: 768px) {
          .container {
            padding: 20px;
          }
          
          h1 {
            font-size: 28px;
          }
          
          .table-container {
            margin-bottom: 15px;
          }
          
          .btn-group {
            flex-direction: column;
          }
          
          .toolbar {
            flex-direction: column;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>VENC KV 管理系统</h1>
        
        <!-- 登录界面 -->
        <div id="login-container">
          <div class="login-form">
            <h2>管理员登录</h2>
            <input type="password" id="password-input" placeholder="请输入密码">
            <button id="login-button" class="btn-primary" style="width: 100%; margin-top: 10px;">登录</button>
            <div id="login-error" class="error-message hidden"></div>
          </div>
        </div>
        
        <!-- 管理界面 -->
        <div id="admin-container" class="hidden">
          <div class="toolbar">
            <button id="refresh-button">刷新数据</button>
            <button id="create-button" class="btn-primary">新建条目</button>
            <button id="export-button">导出数据</button>
            <button id="import-button">导入数据</button>
            <button id="clear-all-button" class="btn-danger">清空键值</button>
            <div class="search-container">
              <input type="text" id="search-input" placeholder="输入关键词搜索">
              <button id="search-button">搜索</button>
              <button id="clear-search-button" class="hidden">清除</button>
            </div>
            <input type="file" id="import-file" accept=".json" class="hidden">
          </div>
          
          <!-- 数据表格 -->
          <div class="table-container">
            <table id="data-table">
              <thead>
                <tr>
                  <th class="sortable" data-field="Num">Num <span class="sort-icon asc">↑</span></th>
                  <th class="sortable" data-field="Time">Time <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="Cloud_Path">Cloud_Path <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="Designation">Designation <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="ENC_Algorithm">ENC_Algorithm <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="ENC_ID">ENC_ID <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="File_Name">File_Name <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="File_Size">File_Size <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="Type">Type <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="Tag">Tag <span class="sort-icon"></span></th>
                  <th class="sortable" data-field="Password">Password <span class="sort-icon"></span></th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="data-body">
                <!-- 数据行将通过 JavaScript 动态生成 -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <script>
        // 检查登录状态（页面加载时执行）
        function checkLoginStatus() {
          try {
            const loginData = localStorage.getItem('venc_admin_login');
            if (loginData) {
              const { timestamp, isLoggedIn } = JSON.parse(loginData);
              const now = Date.now();
              const tenMinutes = 30 * 60 * 1000;
              
              // 检查登录状态是否有效（未过期且已登录）
              if (isLoggedIn && (now - timestamp < tenMinutes)) {
                document.getElementById('login-container').classList.add('hidden');
                document.getElementById('admin-container').classList.remove('hidden');
                loadData(); // 加载数据
                return true;
              }
            }
          } catch (error) {
            console.error('检查登录状态失败:', error);
          }
          return false;
        }
        
        // 保存登录状态到localStorage
        function saveLoginStatus(isLoggedIn) {
          try {
            localStorage.setItem('venc_admin_login', JSON.stringify({
              timestamp: Date.now(),
              isLoggedIn: isLoggedIn
            }));
          } catch (error) {
            console.error('保存登录状态失败:', error);
          }
        }
        
        // 应用搜索过滤
        function applySearch(entries) {
          if (!searchKeyword.trim()) {
            return entries;
          }
          
          const keyword = searchKeyword.toLowerCase().trim();
          return entries.filter(entry => {
            // 遍历条目的所有字段
            for (const key in entry) {
              if (entry.hasOwnProperty(key) && key !== 'key') {
                const value = String(entry[key] || '').toLowerCase();
                // 全词匹配搜索
                if (value.includes(keyword)) {
                  return true;
                }
              }
            }
            return false;
          });
        }
        
        // 登出功能
        function logout() {
          saveLoginStatus(false);
          document.getElementById('admin-container').classList.add('hidden');
          document.getElementById('login-container').classList.remove('hidden');
          document.getElementById('password-input').value = '';
        }
        
        // 登录功能
        document.getElementById('login-button').addEventListener('click', async () => {
          const password = document.getElementById('password-input').value;
          const errorDiv = document.getElementById('login-error');
          
          try {
            const response = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (data.success) {
              saveLoginStatus(true); // 保存登录状态
              document.getElementById('login-container').classList.add('hidden');
              document.getElementById('admin-container').classList.remove('hidden');
              loadData(); // 登录成功后加载数据
            } else {
              errorDiv.textContent = '密码错误';
              errorDiv.classList.remove('hidden');
            }
          } catch (error) {
            errorDiv.textContent = '登录失败，请重试';
            errorDiv.classList.remove('hidden');
          }
        });
        
        // 全局变量
        let sortField = 'Num';
        let sortDirection = 'asc';
        let searchKeyword = '';
        let allEntries = []; // 存储所有原始数据
        
        // 执行搜索
        function performSearch() {
          searchKeyword = document.getElementById('search-input').value;
          
          // 显示/隐藏清除按钮
          const clearButton = document.getElementById('clear-search-button');
          if (searchKeyword.trim()) {
            clearButton.classList.remove('hidden');
          } else {
            clearButton.classList.add('hidden');
          }
          
          // 重新加载并过滤数据
          loadData();
        }
        
        // 清除搜索
        function clearSearch() {
          document.getElementById('search-input').value = '';
          searchKeyword = '';
          document.getElementById('clear-search-button').classList.add('hidden');
          loadData();
        }
        
        // 绑定表头排序事件
        function setupSorting() {
          const headers = document.querySelectorAll('.sortable');
          headers.forEach(header => {
            header.addEventListener('click', () => {
              const field = header.getAttribute('data-field');
              
              // 如果点击的是当前排序字段，则切换排序方向
              if (sortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
              } else {
                // 否则设置新的排序字段并默认升序
                sortField = field;
                sortDirection = 'asc';
              }
              
              // 更新排序图标
              updateSortIcons();
              
              // 重新加载数据并排序
              loadData();
            });
          });
        }
        
        // 更新排序图标
        function updateSortIcons() {
          const headers = document.querySelectorAll('.sortable');
          headers.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            const field = header.getAttribute('data-field');
            
            // 清除所有排序图标
            icon.className = 'sort-icon';
            
            // 为当前排序字段设置图标
            if (sortField === field) {
              icon.classList.add(sortDirection);
            }
          });
        }
        
        // 自定义排序函数
        function customSort(a, b) {
          let valueA = a[sortField] || '';
          let valueB = b[sortField] || '';
          
          // 确保值是字符串
          valueA = String(valueA);
          valueB = String(valueB);
          
          // 判断是否为数字（整数或小数）
          const isNumberA = !isNaN(valueA) && valueA.trim() !== '';
          const isNumberB = !isNaN(valueB) && valueB.trim() !== '';
          
          // 数字优先排序
          if (isNumberA && isNumberB) {
            // 转换为数字进行比较
            const numA = parseFloat(valueA);
            const numB = parseFloat(valueB);
            return sortDirection === 'asc' ? numA - numB : numB - numA;
          } else if (isNumberA) {
            // A是数字，B不是，数字排在前面
            return sortDirection === 'asc' ? -1 : 1;
          } else if (isNumberB) {
            // B是数字，A不是，数字排在前面
            return sortDirection === 'asc' ? 1 : -1;
          } else {
            // 都不是数字，按字符串a-z排序
            return sortDirection === 'asc' 
              ? valueA.localeCompare(valueB) 
              : valueB.localeCompare(valueA);
          }
        }
        
        // 加载数据
        async function loadData() {
          try {
            const response = await fetch('/api/entries');
            allEntries = await response.json();
            
            // 应用搜索过滤
            let entries = applySearch(allEntries);
            
            // 应用排序
            entries.sort(customSort);
            
            const tableBody = document.getElementById('data-body');
            tableBody.innerHTML = '';
            
            if (entries.length === 0) {
              const row = document.createElement('tr');
              row.innerHTML = '<td colspan="10" style="text-align: center;">暂无数据</td>';
              tableBody.appendChild(row);
            } else {
              entries.forEach(entry => {
                const row = document.createElement('tr');
                row.setAttribute('data-key', entry.key);
                row.innerHTML = '<td class="edit-field" data-field="Num">' + entry.Num + '</td>' +
                  '<td class="edit-field" data-field="Time">' + (entry.Time || '') + '</td>' +
                  '<td class="edit-field" data-field="Cloud_Path">' + entry.Cloud_Path + '</td>' +
                  '<td class="edit-field" data-field="Designation">' + entry.Designation + '</td>' +
                  '<td class="edit-field" data-field="ENC_Algorithm">' + entry.ENC_Algorithm + '</td>' +
                  '<td class="edit-field" data-field="ENC_ID">' + entry.ENC_ID + '</td>' +
                  '<td class="edit-field" data-field="File_Name">' + entry.File_Name + '</td>' +
                  '<td class="edit-field" data-field="File_Size">' + entry.File_Size + '</td>' +
                  '<td class="edit-field" data-field="Type">' + entry.Type + '</td>' +
                  '<td class="edit-field" data-field="Tag">' + (entry.Tag || '') + '</td>' +
                  '<td class="edit-field" data-field="Password">' + (entry.Password || '') + '</td>' +
                  '<td>' +
                  '  <button class="edit-btn" data-key="' + entry.key + '">编辑</button>' +
                  '  <button class="delete-btn btn-danger" data-key="' + entry.key + '">删除</button>' +
                  '  <button class="save-btn hidden btn-primary" data-key="' + entry.key + '">保存</button>' +
                  '  <button class="cancel-btn hidden" data-key="' + entry.key + '">取消</button>' +
                  '</td>';
                tableBody.appendChild(row);
              });
              
              // 绑定编辑按钮事件
              document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  const key = e.target.getAttribute('data-key');
                  enterEditMode(key);
                });
              });
              
              // 绑定删除按钮事件
              document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  if (confirm('确定要删除这条记录吗？')) {
                    const key = e.target.getAttribute('data-key');
                    await deleteEntry(key);
                  }
                });
              });
              
              // 绑定保存按钮事件
              document.querySelectorAll('.save-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  const key = e.target.getAttribute('data-key');
                  await saveRowEdit(key);
                });
              });
              
              // 绑定取消按钮事件
              document.querySelectorAll('.cancel-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  const key = e.target.getAttribute('data-key');
                  exitEditMode(key);
                });
              });
            }
          } catch (error) {
            console.error('加载数据失败:', error);
            alert('加载数据失败，请重试');
          }
        }
        
        // 页面加载时设置排序和检查登录状态
        window.addEventListener('load', () => {
          setupSorting();
          checkLoginStatus();
          
          // 绑定搜索按钮事件
          document.getElementById('search-button').addEventListener('click', performSearch);
          
          // 绑定搜索框回车事件
          document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              performSearch();
            }
          });
          
          // 绑定清除搜索按钮事件
          document.getElementById('clear-search-button').addEventListener('click', clearSearch);
        });
        
        // 当前正在编辑的行的key
        let currentEditingKey = null;
        
        // 进入编辑模式
        async function enterEditMode(key) {
          // 如果已经有行在编辑中，则取消之前的编辑
          if (currentEditingKey && currentEditingKey !== key) {
            exitEditMode(currentEditingKey);
          }
          
          // 获取行元素
          const row = document.querySelector('tr[data-key="' + key + '"]');
          if (!row) return;
          
          // 获取条目的原始数据，用于取消编辑时恢复
          try {
            const response = await fetch('/api/entry/' + key);
            const entry = await response.json();
            
            if (entry) {
              // 保存原始数据到行元素
              row.setAttribute('data-original-data', JSON.stringify(entry));
              
              // 将单元格内容转换为输入框
              const fields = row.querySelectorAll('.edit-field');
              fields.forEach(cell => {
                const field = cell.getAttribute('data-field');
                const value = cell.textContent;
                
                if (field === 'Num') {
                  // Num字段只读
                  cell.innerHTML = value;
                } else {
                  // 其他字段可编辑
                  cell.innerHTML = '<input type="text" value="' + escapeHtml(value) + '" data-field="' + field + '">';
                }
              });
              
              // 切换按钮显示
              row.querySelector('.edit-btn').classList.add('hidden');
              row.querySelector('.delete-btn').classList.add('hidden');
              row.querySelector('.save-btn').classList.remove('hidden');
              row.querySelector('.cancel-btn').classList.remove('hidden');
              
              // 标记当前编辑的行
              currentEditingKey = key;
            }
          } catch (error) {
            console.error('进入编辑模式失败:', error);
            alert('进入编辑模式失败，请重试');
          }
        }
        
        // 退出编辑模式（取消编辑）
        function exitEditMode(key) {
          const row = document.querySelector('tr[data-key="' + key + '"]');
          if (!row) return;
          
          try {
            // 获取保存的原始数据
            const originalData = JSON.parse(row.getAttribute('data-original-data'));
            
            // 恢复单元格内容
            const fields = row.querySelectorAll('.edit-field');
            fields.forEach(cell => {
              const field = cell.getAttribute('data-field');
              cell.textContent = originalData[field] || '';
            });
            
            // 移除保存的原始数据
            row.removeAttribute('data-original-data');
          } catch (error) {
            console.error('恢复原始数据失败:', error);
          }
          
          // 切换按钮显示
          row.querySelector('.edit-btn').classList.remove('hidden');
          row.querySelector('.delete-btn').classList.remove('hidden');
          row.querySelector('.save-btn').classList.add('hidden');
          row.querySelector('.cancel-btn').classList.add('hidden');
          
          // 清除当前编辑的行标记
          currentEditingKey = null;
        }
        
        // 保存行编辑
        async function saveRowEdit(key) {
          const row = document.querySelector('tr[data-key="' + key + '"]');
          if (!row) return;
          
          // 收集编辑后的数据
          const data = {};
          const inputs = row.querySelectorAll('input[data-field]');
          inputs.forEach(input => {
            const field = input.getAttribute('data-field');
            data[field] = input.value || '';
          });
          
          // 添加Num字段（不可编辑，但需要保留）
          const numCell = row.querySelector('.edit-field[data-field="Num"]');
          data.Num = numCell.textContent;
          
          try {
            // 发送保存请求
            const response = await fetch('/api/update/' + key, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
              // 保存成功后重新加载数据
              loadData();
              currentEditingKey = null;
            } else {
              alert(result.message || '保存失败');
            }
          } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败，请重试');
          }
        }
        
        // HTML转义函数
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
        
        // 刷新按钮
        document.getElementById('refresh-button').addEventListener('click', loadData);
        
        // 创建新条目按钮
        document.getElementById('create-button').addEventListener('click', async () => {
          try {
            // 创建一个新条目
            const response = await fetch('/api/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                Cloud_Path: 'OTTC',
                Designation: '',
                ENC_Algorithm: 'VENC-AES-GCM256bit',
                ENC_ID: '',
                File_Name: '',
                File_Size: '',
                Password: '',
                Type: 'TAV',
                Tag: ''
              })
            });
            
            const result = await response.json();
            
            if (result.success) {
              // 创建成功后重新加载数据并进入编辑模式
              await loadData();
              // 查找新创建的条目（通常是Num最大的那个）
              setTimeout(() => {
                const entries = document.querySelectorAll('tr[data-key]');
                if (entries.length > 0) {
                  const lastEntry = entries[entries.length - 1];
                  const key = lastEntry.getAttribute('data-key');
                  enterEditMode(key);
                }
              }, 500);
            } else {
              alert(result.message || '创建失败');
            }
          } catch (error) {
            console.error('创建新条目失败:', error);
            alert('创建新条目失败，请重试');
          }
        });
        
        // 删除条目
        async function deleteEntry(key) {
          try {
            const response = await fetch('/api/delete/' + key, {
              method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
              loadData(); // 删除成功后重新加载数据
            } else {
              alert(result.message || '删除失败');
            }
          } catch (error) {
            console.error('删除条目失败:', error);
            alert('删除条目失败，请重试');
          }
        }
        
        // 导出数据
        document.getElementById('export-button').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/export', {
              method: 'GET'
            });
            
            const result = await response.json();
            
            if (result.success) {
              // 创建下载链接并触发下载
              const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'venc_export_' + new Date().toISOString().slice(0,10) + '.json';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } else {
              alert(result.message || '导出失败');
            }
          } catch (error) {
            console.error('导出数据失败:', error);
            alert('导出数据失败，请重试');
          }
        });
        
        // 清空键值按钮事件
        document.getElementById('clear-all-button').addEventListener('click', () => {
          showPasswordDialog('clearAll');
        });
        
        // 显示密码验证对话框
        function showPasswordDialog(action) {
          // 检查密码对话框是否已存在，如果不存在则创建
          let dialog = document.getElementById('password-dialog');
          if (!dialog) {
            dialog = document.createElement('div');
            dialog.id = 'password-dialog';
            dialog.className = 'password-dialog hidden';
            dialog.innerHTML = 
              '<div class="password-dialog-content">' +
              '  <h3>管理员密码验证</h3>' +
              '  <input type="password" id="verify-password" placeholder="请输入管理员密码">' +
              '  <div id="verify-error" class="error-message hidden"></div>' +
              '  <div class="password-dialog-buttons">' +
              '    <button id="verify-cancel">取消</button>' +
              '    <button id="verify-confirm" class="btn-primary">确认</button>' +
              '  </div>' +
              '</div>';
            document.body.appendChild(dialog);
            
            // 绑定对话框按钮事件
            document.getElementById('verify-cancel').addEventListener('click', () => {
              dialog.classList.add('hidden');
              document.getElementById('verify-password').value = '';
              document.getElementById('verify-error').classList.add('hidden');
            });
            
            document.getElementById('verify-confirm').addEventListener('click', async () => {
              const password = document.getElementById('verify-password').value;
              const errorDiv = document.getElementById('verify-error');
              
              try {
                // 验证密码
                const response = await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                  // 密码验证成功，执行相应操作
                  if (action === 'clearAll') {
                    await clearAllEntries();
                  }
                  
                  dialog.classList.add('hidden');
                  document.getElementById('verify-password').value = '';
                  errorDiv.classList.add('hidden');
                } else {
                  errorDiv.textContent = '密码错误，请重试';
                  errorDiv.classList.remove('hidden');
                }
              } catch (error) {
                errorDiv.textContent = '验证失败，请重试';
                errorDiv.classList.remove('hidden');
              }
            });
          }
          
          // 显示对话框
          dialog.classList.remove('hidden');
        }
        
        // 清空所有条目
        async function clearAllEntries() {
          if (!confirm('警告：此操作将删除所有数据，且无法恢复。确定要继续吗？')) {
            return;
          }
          
          try {
            const response = await fetch('/api/clear-all', {
              method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
              alert('所有数据已清空');
              loadData(); // 清空后重新加载数据
            } else {
              alert(result.message || '清空失败');
            }
          } catch (error) {
            console.error('清空数据失败:', error);
            alert('清空数据失败，请重试');
          }
        }
        
        // 导入数据
        document.getElementById('import-button').addEventListener('click', () => {
          document.getElementById('import-file').click();
        });
        
        document.getElementById('import-file').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          
          try {
            // 验证文件类型
            if (!file.name.endsWith('.json')) {
              alert('请选择JSON格式的文件');
              e.target.value = ''; // 重置文件选择
              return;
            }
            
            // 读取文件内容
            const reader = new FileReader();
            reader.onload = async (event) => {
              try {
                const jsonData = JSON.parse(event.target.result);
                
                // 发送导入请求
                const response = await fetch('/api/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(jsonData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                  alert(result.message);
                  loadData(); // 导入成功后重新加载数据
                } else {
                  alert(result.message || '导入失败');
                }
              } catch (error) {
                alert('JSON解析错误: ' + error.message);
              }
            };
            reader.readAsText(file);
          } catch (error) {
            console.error('导入数据失败:', error);
            alert('导入数据失败，请重试');
          } finally {
            e.target.value = ''; // 重置文件选择
          }
        });
      </script>
    </body>
    </html>`;
}

// 导出数据功能
async function exportData() {
  try {
    const entries = await getAllEntries();
    return { success: true, data: entries };
  } catch (error) {
    console.error('导出数据失败:', error);
    return { success: false, message: '导出失败', error: error.message };
  }
}

// 导入数据功能
async function importData(jsonData) {
  try {
    console.log('开始导入数据，数据类型:', typeof jsonData, '数据长度:', jsonData ? (Array.isArray(jsonData) ? jsonData.length : '非数组') : 'null');
    
    // 确保导入的数据是数组格式
    if (!Array.isArray(jsonData)) {
      throw new Error('导入的数据必须是JSON数组格式');
    }

    const importedKeys = [];
    const skippedKeys = [];

    // 首先获取所有已存在的键，用于验证
    const entries = await getAllEntries();
    const existingKeys = new Set(entries.map(entry => entry.key));
    
    console.log('现有条目数量:', entries.length);
    
    // 定义有效的系统键结构
    const validKeys = ['Cloud_Path', 'Designation', 'ENC_Algorithm', 'ENC_ID', 'File_Name', 'File_Size', 'Password', 'Type', 'Tag'];

    // 预先获取下一个可用的Num值
    let nextNum = await generateNextNum();
    console.log('初始下一个Num值:', nextNum);

    // 处理每个导入的条目
    for (let i = 0; i < jsonData.length; i++) {
      const item = jsonData[i];
      
      try {
        console.log(`处理第${i+1}条数据:`, item ? '有数据' : '空数据');
        
        // 检查条目是否为对象
        if (!item || typeof item !== 'object') {
          skippedKeys.push(`第${i+1}条 (非对象)`);
          console.log(`跳过第${i+1}条数据: 非对象`);
          continue;
        }

        // 检查是否有导入的key，如果没有则自动生成
        let itemKey = item.key;
        let isNewEntry = false;
        let currentNum = nextNum; // 为当前条目分配Num值
        
        if (!itemKey) {
          // 自动生成新的key
          itemKey = `ENTRY_${currentNum}`;
          isNewEntry = true;
          console.log(`自动生成新key: ${itemKey} (Num: ${currentNum})`);
          nextNum++; // 为下一条目准备Num值
        } else if (!existingKeys.has(itemKey)) {
          // 提供了key但不存在，视为新条目
          isNewEntry = true;
          console.log(`提供的key不存在，视为新条目: ${itemKey} (Num: ${currentNum})`);
          nextNum++; // 为下一条目准备Num值
        }

        // 构建数据对象
        const entryData = {};
        
        // 检查key是否已存在
        if (existingKeys.has(itemKey)) {
          // 现有条目，先获取现有数据
          const existingEntry = entries.find(entry => entry.key === itemKey);
          if (existingEntry) {
            // 复制现有条目的所有字段（不包括key）
            for (const key in existingEntry) {
              if (key !== 'key') {
                entryData[key] = existingEntry[key];
              }
            }
          }
          // 保留现有时间戳
          if (entryData.Time) {
            console.log(`保留现有时间戳: ${entryData.Time}`);
          }
        } else {
          // 新条目，设置默认值
          entryData.ENC_Algorithm = 'VENC-AES-GCM256bit';
          entryData.Type = 'TAV';
          entryData.Time = generateBeijingTime();
          console.log(`创建新条目: ${itemKey}`);
        }

        // 确保Num字段始终存在且由系统生成
        if (!entryData.Num) {
          entryData.Num = currentNum;
          console.log(`设置Num: ${currentNum} 用于 ${itemKey}`);
        }

        // 更新有效字段（如果有数据且不为undefined）
        for (const key of validKeys) {
          if (key in item && item[key] !== undefined) {
            entryData[key] = item[key];
            console.log(`更新字段 ${key}: ${item[key]}`);
          } else if (isNewEntry) {
            // 新条目，确保没有值的字段为空字符串
            entryData[key] = '';
          }
        }

        console.log('准备写入KV的数据:', JSON.stringify(entryData));
        
        // 保存条目
        try {
          await VENC_KV_NAMESPACE.put(itemKey, JSON.stringify(entryData));
          importedKeys.push(itemKey);
          console.log('成功写入条目:', itemKey, isNewEntry ? '(新条目)' : '(更新条目)');
        } catch (kvError) {
          console.error('写入KV失败，键:', itemKey, '错误:', kvError);
          skippedKeys.push(itemKey + ' (写入失败: ' + kvError.message + ')');
        }
      } catch (itemError) {
        console.error(`处理第${i+1}条数据时出错:`, itemError);
        skippedKeys.push(`第${i+1}条 (处理错误: ${itemError.message})`);
      }
    }

    console.log(`导入完成: 成功${importedKeys.length}条，跳过${skippedKeys.length}条`);
    
    return {
      success: true,
      message: `成功导入 ${importedKeys.length} 条数据，跳过 ${skippedKeys.length} 条无效的数据`,
      importedKeys: importedKeys,
      skippedKeys: skippedKeys
    };
  } catch (error) {
    console.error('导入数据失败:', error);
    return { success: false, message: '导入失败', error: error.message };
  }
}

// 清空所有 KV 条目
async function clearAllEntries() {
  try {
    const list = await VENC_KV_NAMESPACE.list({ prefix: 'ENTRY_' });
    
    // 批量删除所有条目
    const deletePromises = list.keys.map(key => VENC_KV_NAMESPACE.delete(key.name));
    await Promise.all(deletePromises);
    
    return { success: true, message: '所有数据已清空' };
  } catch (error) {
    console.error('清空所有条目失败:', error);
    return { success: false, message: '清空失败', error: error.message };
  }
}

// 主处理函数
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  // 为所有响应添加CORS头
  const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    return response;
  };
  
  // 清空所有条目的端点
  if (url.pathname === '/api/clear-all' && request.method === 'DELETE') {

    
    const result = await clearAllEntries();
    
    const response = new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 健康检查端点 - 保留API密钥验证
  if (url.pathname === '/health') {
    // 验证身份秘钥
    if (API_KEY !== 'default_api_key' && !validateApiKey(request)) {
      const response = new Response('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      });
      return addCorsHeaders(response);
    }
    
    const response = new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
    return addCorsHeaders(response);
  }
  
  // API 端点：接收 VENC 应用发送的数据 - 保留API密钥验证
  if (url.pathname === '/api/venc' && request.method === 'POST') {
    // 验证身份秘钥
    if (API_KEY !== 'default_api_key' && !validateApiKey(request)) {
      const response = new Response(JSON.stringify({
        success: false,
        message: '身份验证失败：无效的API密钥'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
    
    // 验证请求头
    if (!validateRequest(request)) {
      const response = new Response(JSON.stringify({
        success: false,
        message: '只接受 Content-Type: application/json 的请求'
      }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
    
    try {
      const data = await request.json();
      const result = await handleApiRequest(data);
      
      const response = new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      const response = new Response(JSON.stringify({
        success: false,
        message: '请求处理失败',
        error: error.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }
  
  // 管理界面相关 API
  
  // 登录认证
  if (url.pathname === '/api/auth' && request.method === 'POST') {
    // 无需API密钥验证，这是登录认证的端点
    
    if (!validateRequest(request)) {
      const response = new Response(JSON.stringify({ success: false, message: '无效的请求格式' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
    
    try {
      const { password } = await request.json();
      const isAuthenticated = authenticate(password);
      
      const response = new Response(JSON.stringify({
        success: isAuthenticated,
        message: isAuthenticated ? '认证成功' : '密码错误'
      }), {
        status: isAuthenticated ? 200 : 401,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      const response = new Response(JSON.stringify({ success: false, message: '认证失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }
  
  // 获取所有条目 - 不需要API密钥验证
  if (url.pathname === '/api/entries' && request.method === 'GET') {
    const entries = await getAllEntries();
    const response = new Response(JSON.stringify(entries), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 获取单个条目 - 不需要API密钥验证
  if (url.pathname.match(/^\/api\/entry\/([^/]+)$/) && request.method === 'GET') {
    const key = url.pathname.split('/').pop();
    const entry = await getEntry(key);
    const response = new Response(JSON.stringify(entry), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 更新条目 - 不需要API密钥验证
  if (url.pathname.match(/^\/api\/update\/([^/]+)$/) && request.method === 'PUT') {
    
    if (!validateRequest(request)) {
      const response = new Response(JSON.stringify({ success: false, message: '无效的请求格式' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
    
    try {
      const key = url.pathname.split('/').pop();
      const data = await request.json();
      const result = await updateEntry(key, data);
      
      const response = new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      const response = new Response(JSON.stringify({ success: false, message: '更新失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }
  
  // 创建新条目 - 不需要API密钥验证
  if (url.pathname === '/api/create' && request.method === 'POST') {
    if (!validateRequest(request)) {
      const response = new Response(JSON.stringify({ success: false, message: '无效的请求格式' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
    
    try {
      const data = await request.json();
      const result = await createNewEntry(data);
      
      const response = new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      const response = new Response(JSON.stringify({ success: false, message: '创建失败' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }
  
  // 删除条目 - 不需要API密钥验证
  if (url.pathname.match(/^\/api\/delete\/([^/]+)$/) && request.method === 'DELETE') {
    try {
      const key = url.pathname.split('/').pop();
      await VENC_KV_NAMESPACE.delete(key);
      
      const response = new Response(JSON.stringify({ success: true, message: '删除成功' }), {
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    } catch (error) {
      const response = new Response(JSON.stringify({ success: false, message: '删除失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return addCorsHeaders(response);
    }
  }
  
  // 导出数据API
  if (url.pathname === '/api/export' && request.method === 'GET') {
    const result = await exportData();
    const response = new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 导入数据 API 端点
    if (url.pathname === '/api/import' && request.method === 'POST') {
      try {
        console.log('接收到导入数据请求');
        
        // 获取请求内容类型
        const contentType = request.headers.get('content-type') || '';
        let jsonData;
        
        // 处理不同格式的数据
        if (contentType.includes('application/json')) {
          try {
            jsonData = await request.json();
          } catch (jsonError) {
            throw new Error('请求体不是有效的JSON格式');
          }
        } else {
          throw new Error('不支持的内容类型，仅支持application/json');
        }

        console.log('导入数据解析成功，准备处理');
        
        // 调用导入数据函数处理导入
        const result = await importData(jsonData);

        console.log('导入处理完成，结果:', result.success ? '成功' : '失败');
        
        // 返回导入结果
        const response = new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);
      } catch (error) {
        console.error('导入API端点错误:', error);
        const response = new Response(JSON.stringify({ 
          success: false, 
          message: '导入失败', 
          error: error.message 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);
      }
    }
  
  // 管理界面
  if (url.pathname === '/' || url.pathname === '/admin') {
    const response = new Response(generateAdminInterface(), {
      headers: { 'Content-Type': 'text/html' }
    });
    return addCorsHeaders(response);
  }
  
  // 404 未找到
  const response = new Response(JSON.stringify({
    success: false,
    message: '请求的资源不存在'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
  return addCorsHeaders(response);
}

// 导出 worker 处理函数
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});