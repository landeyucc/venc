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

// 生成下一个序列号
async function generateNextNum() {
  try {
    // 从 KV 获取当前最大序列号
    const currentMaxNum = await VENC_KV_NAMESPACE.get('MAX_NUM', { type: 'json' });
    const nextNum = (currentMaxNum || 0) + 1;
    
    // 保存新的最大序列号
    await VENC_KV_NAMESPACE.put('MAX_NUM', JSON.stringify(nextNum));
    return nextNum;
  } catch (error) {
    console.error('生成序列号失败:', error);
    return Date.now(); // 失败时使用时间戳作为后备
  }
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
      Tag: '' // 默认留空
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
    
    // 按序列号排序
    entries.sort((a, b) => parseInt(a.Num) - parseInt(b.Num));
    
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
      Tag: data.Tag || ''
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

        /* 工具栏样式 */
        .toolbar {
          margin-bottom: 30px;
          display: flex;
          gap: 16px;
        }

        /* 隐藏元素 */
        .hidden {
          display: none;
        }

        /* 表格样式 */
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          overflow: hidden;
          border-radius: var(--radius);
          background-color: var(--bg-main);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        th, td {
          padding: 16px;
          text-align: left;
          border-bottom: 1px solid rgba(163, 177, 198, 0.1);
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

        /* 表格内按钮样式 */
        .edit-btn, .delete-btn {
          padding: 6px 12px;
          font-size: 14px;
          margin-right: 8px;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .container {
            padding: 20px;
          }
          
          h1 {
            font-size: 28px;
          }
          
          table {
            display: block;
            overflow-x: auto;
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
          </div>
          
          <!-- 数据表格 -->
          <table id="data-table">
            <thead>
              <tr>
                <th>Num</th>
                <th>Cloud_Path</th>
                <th>Designation</th>
                <th>ENC_Algorithm</th>
                <th>ENC_ID</th>
                <th>File_Name</th>
                <th>File_Size</th>
                <th>Type</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="data-body">
              <!-- 数据行将通过 JavaScript 动态生成 -->
            </tbody>
          </table>
          
          <!-- 编辑表单 -->
          <div id="edit-form" class="edit-form hidden">
            <h3>编辑条目</h3>
            <input type="hidden" id="edit-key">
            
            <div class="form-group">
              <label for="edit-Num">Num:</label>
              <input type="text" id="edit-Num" readonly>
            </div>
            
            <div class="form-group">
              <label for="edit-Cloud_Path">Cloud_Path:</label>
              <input type="text" id="edit-Cloud_Path">
            </div>
            
            <div class="form-group">
              <label for="edit-Designation">Designation:</label>
              <input type="text" id="edit-Designation">
            </div>
            
            <div class="form-group">
              <label for="edit-ENC_Algorithm">ENC_Algorithm:</label>
              <input type="text" id="edit-ENC_Algorithm" readonly>
            </div>
            
            <div class="form-group">
              <label for="edit-ENC_ID">ENC_ID:</label>
              <input type="text" id="edit-ENC_ID">
            </div>
            
            <div class="form-group">
              <label for="edit-File_Name">File_Name:</label>
              <input type="text" id="edit-File_Name">
            </div>
            
            <div class="form-group">
              <label for="edit-File_Size">File_Size:</label>
              <input type="text" id="edit-File_Size">
            </div>
            
            <div class="form-group">
              <label for="edit-Password">Password:</label>
              <input type="text" id="edit-Password">
            </div>
            
            <div class="form-group">
              <label for="edit-Type">Type:</label>
              <input type="text" id="edit-Type">
            </div>
            
            <div class="form-group">
              <label for="edit-Tag">Tag:</label>
              <input type="text" id="edit-Tag">
            </div>
            
            <button id="save-button" class="btn-primary">保存</button>
            <button id="cancel-button">取消</button>
            <div id="save-success" class="success-message hidden">保存成功</div>
            <div id="save-error" class="error-message hidden"></div>
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
              const tenMinutes = 10 * 60 * 1000;
              
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
        
        // 页面加载时检查登录状态
        window.addEventListener('load', checkLoginStatus);
        
        // 刷新按钮
        document.getElementById('refresh-button').addEventListener('click', loadData);
        
        // 创建新条目按钮
        document.getElementById('create-button').addEventListener('click', () => {
          document.getElementById('edit-key').value = '';
          document.getElementById('edit-Num').value = '系统自动生成';
          document.getElementById('edit-Cloud_Path').value = 'OTTC';
          document.getElementById('edit-Designation').value = '';
          document.getElementById('edit-ENC_Algorithm').value = 'VENC-AES-GCM256bit';
          document.getElementById('edit-ENC_ID').value = '';
          document.getElementById('edit-File_Name').value = '';
          document.getElementById('edit-File_Size').value = '';
          document.getElementById('edit-Password').value = '';
          document.getElementById('edit-Type').value = 'TAV';
          document.getElementById('edit-Tag').value = '';
          
          document.getElementById('save-success').classList.add('hidden');
          document.getElementById('save-error').classList.add('hidden');
          document.getElementById('edit-form').classList.remove('hidden');
        });
        
        // 取消编辑按钮
        document.getElementById('cancel-button').addEventListener('click', () => {
          document.getElementById('edit-form').classList.add('hidden');
        });
        
        // 保存按钮
        document.getElementById('save-button').addEventListener('click', async () => {
          const key = document.getElementById('edit-key').value;
          const data = {
            Cloud_Path: document.getElementById('edit-Cloud_Path').value || '',
            Designation: document.getElementById('edit-Designation').value || '',
            ENC_ID: document.getElementById('edit-ENC_ID').value || '',
            File_Name: document.getElementById('edit-File_Name').value || '',
            File_Size: document.getElementById('edit-File_Size').value || '',
            Password: document.getElementById('edit-Password').value || '',
            Type: document.getElementById('edit-Type').value || '',
            Tag: document.getElementById('edit-Tag').value || ''
          };
          
          const successDiv = document.getElementById('save-success');
          const errorDiv = document.getElementById('save-error');
          
          try {
            let endpoint = key ? '/api/update/' + key : '/api/create';
            let method = key ? 'PUT' : 'POST';
            
            const response = await fetch(endpoint, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
              successDiv.textContent = result.message;
              successDiv.classList.remove('hidden');
              errorDiv.classList.add('hidden');
              
              // 保存成功后重新加载数据
              setTimeout(() => {
                loadData();
                document.getElementById('edit-form').classList.add('hidden');
              }, 1000);
            } else {
              errorDiv.textContent = result.message || '保存失败';
              errorDiv.classList.remove('hidden');
              successDiv.classList.add('hidden');
            }
          } catch (error) {
            errorDiv.textContent = '保存失败，请重试';
            errorDiv.classList.remove('hidden');
            successDiv.classList.add('hidden');
          }
        });
        
        // 加载数据
        async function loadData() {
          try {
            const response = await fetch('/api/entries');
            const entries = await response.json();
            
            const tableBody = document.getElementById('data-body');
            tableBody.innerHTML = '';
            
            if (entries.length === 0) {
              const row = document.createElement('tr');
              row.innerHTML = '<td colspan="9" style="text-align: center;">暂无数据</td>';
              tableBody.appendChild(row);
            } else {
              entries.forEach(entry => {
                const row = document.createElement('tr');
                  row.innerHTML = '<td>' + entry.Num + '</td>' +
                    '<td>' + entry.Cloud_Path + '</td>' +
                    '<td>' + entry.Designation + '</td>' +
                    '<td>' + entry.ENC_Algorithm + '</td>' +
                    '<td>' + entry.ENC_ID + '</td>' +
                    '<td>' + entry.File_Name + '</td>' +
                    '<td>' + entry.File_Size + '</td>' +
                    '<td>' + entry.Type + '</td>' +
                    '<td>' +
                    '  <button class="edit-btn" data-key="' + entry.key + '">编辑</button>' +
                    '  <button class="delete-btn btn-danger" data-key="' + entry.key + '">删除</button>' +
                    '</td>';
                tableBody.appendChild(row);
              });
              
              // 绑定编辑按钮事件
              document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  const key = e.target.getAttribute('data-key');
                  await loadEntryForEdit(key);
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
            }
          } catch (error) {
            console.error('加载数据失败:', error);
            alert('加载数据失败，请重试');
          }
        }
        
        // 加载条目进行编辑
        async function loadEntryForEdit(key) {
          try {
            const response = await fetch('/api/entry/' + key);
            const entry = await response.json();
            
            if (entry) {
              document.getElementById('edit-key').value = key;
              document.getElementById('edit-Num').value = entry.Num;
              document.getElementById('edit-Cloud_Path').value = entry.Cloud_Path || '';
              document.getElementById('edit-Designation').value = entry.Designation || '';
              document.getElementById('edit-ENC_Algorithm').value = entry.ENC_Algorithm || 'VENC-AES-GCM256bit';
              document.getElementById('edit-ENC_ID').value = entry.ENC_ID || '';
              document.getElementById('edit-File_Name').value = entry.File_Name || '';
              document.getElementById('edit-File_Size').value = entry.File_Size || '';
              document.getElementById('edit-Password').value = entry.Password || '';
              document.getElementById('edit-Type').value = entry.Type || '';
              document.getElementById('edit-Tag').value = entry.Tag || '';
              
              document.getElementById('save-success').classList.add('hidden');
              document.getElementById('save-error').classList.add('hidden');
              document.getElementById('edit-form').classList.remove('hidden');
            }
          } catch (error) {
            console.error('加载条目失败:', error);
            alert('加载条目失败，请重试');
          }
        }
        
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
      </script>
    </body>
    </html>`;
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
  
  // 健康检查端点
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
  
  // API 端点：接收 VENC 应用发送的数据
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
  
  // 获取所有条目
  if (url.pathname === '/api/entries' && request.method === 'GET') {
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
    
    const entries = await getAllEntries();
    const response = new Response(JSON.stringify(entries), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 获取单个条目
  if (url.pathname.match(/^\/api\/entry\/([^/]+)$/) && request.method === 'GET') {
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
    
    const key = url.pathname.split('/').pop();
    const entry = await getEntry(key);
    const response = new Response(JSON.stringify(entry), {
      headers: { 'Content-Type': 'application/json' }
    });
    return addCorsHeaders(response);
  }
  
  // 更新条目
  if (url.pathname.match(/^\/api\/update\/([^/]+)$/) && request.method === 'PUT') {
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
  
  // 创建新条目
  if (url.pathname === '/api/create' && request.method === 'POST') {
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
  
  // 删除条目
  if (url.pathname.match(/^\/api\/delete\/([^/]+)$/) && request.method === 'DELETE') {
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