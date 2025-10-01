# VENC Cloudflare KV 后端系统

这是一个基于 Cloudflare Workers 和 KV 的后端接收系统，用于处理来自 VENC 应用的加密/解密请求的日志记录，并提供一个现代化拟态UI的管理界面来查询和编辑存储的数据。

<span style="color:red;"><b>提示：此项目特定存储的键值仅供个人使用，如需使用则需自定义修改代码配置。<b/></span>

## 功能特性（个人用途）

- 接收并验证 `Content-Type: application/json` 的请求
- 自动生成序列号并保存数据到 Cloudflare KV
- 从文件名自动提取 Designation 和 File_Name
- 格式化文件大小（从返回的原字节到 GB）
- 提供密码保护的管理界面，采用现代化拟态UI设计
- 支持查询、编辑、创建和删除 KV 条目
- 数据按序列号排序
- 响应式设计，适应不同屏幕尺寸
- 支持API Key身份验证，保护API端点安全

## 部署指南

### 前提条件

- Cloudflare Workers
- Cloudflare KV 命名空间

### 部署步骤

1. **创建 KV 命名空间**
   - 登录 Cloudflare 控制台
   - 导航到 `Workers & Pages > KV`
   - 点击 `Create a Namespace`，命名为 `VENC_KV` 或其他名称

2. **创建 Worker**
   - 导航到 `Workers & Pages > Create application > Create Worker`
   - 为 Worker 命名，点击 `Deploy`
   - 点击 `Edit code` 进入代码编辑器

3. **配置 Worker**
   - 复制 `worker.js` 的内容到代码编辑器
   - 点击 `Settings > Variables > Environment Variables`
   - 添加环境变量 `ENV_ADMIN_PASSWORD`，设置为您的管理员密码
   - 添加环境变量 `ENV_API_KEY`，设置为您的API密钥（可选，如不设置则所有API请求将直接通过）
   - 点击 `Settings > Variables > KV Namespaces`
   - 点击 `Add binding`，变量名设置为 `KV_NAMESPACE`，选择您创建的 KV 命名空间

4. **部署 Worker**
   - 点击 `Deploy` 按钮部署 Worker
   - 记录 Worker 的 URL（例如：`your-worker-name.your-subdomain.workers.dev`），建议绑定自定义域名

## API 端点
### 配置

前端配置时需填入完整worker绑定域名地址加/api/venc

例如域名为`https://venclist.0xl.cc/`

那么前端的配置窗口内的服务器URL则填写`https://venclist.0xl.cc/api/venc`

### API 身份验证

如果设置了 `ENV_API_KEY` 环境变量，则所有API端点（除 `/admin`、`/api/auth` 外）都需要在请求头中包含 `X-API-Key` 字段，其值应与设置的API密钥匹配。

### `/api/venc` (POST)

接收来自 VENC 应用的加密/解密请求。

**请求格式：**
```json
{
  "filename": "文件名",
  "size": "文件大小（字节）",
  "uuid": "UUID",
  "password": "密码"
}
```

**响应格式：**
```json
{
  "success": true/false,
  "message": "操作结果消息",
  "entry": {
    "Num": 序列号,
    "Cloud_Path": "云路径",
    "Designation": "指定符",
    "ENC_Algorithm": "加密算法",
    "ENC_ID": "加密ID",
    "File_Name": "文件名",
    "File_Size": "文件大小(GB)",
    "Password": "密码",
    "Type": "类型",
    "Tag": "标签"
  }
}
```

### `/api/auth` (POST)

管理员登录认证。

**请求格式：**
```json
{
  "password": "管理员密码"
}
```

**响应格式：**
```json
{
  "success": true/false,
  "message": "认证结果消息"
}
```

### `/api/entries` (GET)

获取所有 KV 条目。

**响应格式：**
```json
[
  {
    "key": "KV键名",
    "Num": 序列号,
    "Cloud_Path": "云路径",
    "Designation": "指定符",
    "ENC_Algorithm": "加密算法",
    "ENC_ID": "加密ID",
    "File_Name": "文件名",
    "File_Size": "文件大小(GB)",
    "Password": "密码",
    "Type": "类型",
    "Tag": "标签"
  },
  // 更多条目...
]
```

### `/api/entry/{key}` (GET)

获取单个 KV 条目。

**响应格式：**
```json
{
  "Num": 序列号,
  "Cloud_Path": "云路径",
  "Designation": "指定符",
  "ENC_Algorithm": "加密算法",
  "ENC_ID": "加密ID",
  "File_Name": "文件名",
  "File_Size": "文件大小(GB)",
  "Password": "密码",
  "Type": "类型",
  "Tag": "标签"
}
```

### `/api/update/{key}` (PUT)

更新 KV 条目。

**请求格式：**
```json
{
  "Cloud_Path": "云路径",
  "Designation": "指定符",
  "ENC_ID": "加密ID",
  "File_Name": "文件名",
  "File_Size": "文件大小(GB)",
  "Password": "密码",
  "Type": "类型",
  "Tag": "标签"
}
```

**响应格式：**
```json
{
  "success": true/false,
  "message": "更新结果消息"
}
```

### `/api/create` (POST)

创建新的 KV 条目。

**请求格式：**
```json
{
  "Cloud_Path": "云路径",
  "Designation": "指定符",
  "ENC_ID": "加密ID",
  "File_Name": "文件名",
  "File_Size": "文件大小(GB)",
  "Password": "密码",
  "Type": "类型",
  "Tag": "标签"
}
```

**响应格式：**
```json
{
  "success": true/false,
  "message": "创建结果消息",
  "entry": {
    // 创建的条目数据
  },
  "key": "KV键名"
}
```

### `/api/delete/{key}` (DELETE)

删除 KV 条目。

**响应格式：**
```json
{
  "success": true/false,
  "message": "删除结果消息"
}
```

### `/admin` 或 `/`

管理界面，需要管理员密码登录。

## 管理界面使用说明

1. 直接访问 Worker 的 URL（例如：`your-worker-name.your-subdomain.workers.dev`）
2. 输入管理员密码登录
3. 登录后可以看到所有存储的数据，以表格形式展示
4. 使用工具栏的按钮可以刷新数据或创建新条目
5. 每行数据都有编辑和删除按钮
6. 点击编辑按钮可以修改数据，点击保存按钮保存更改

### 管理界面特性

- 现代化拟态UI设计，提供精致的3D视觉效果
- 柔和的紫色主题色调，提升界面美感
- 交互动画效果，包括按钮悬停和点击反馈
- 凹陷式输入框设计，增强用户体验
- 响应式布局，在移动设备上依然保持良好的可用性

## 注意事项

- 请妥善保管管理员密码和API密钥，建议使用强密码
- 所有敏感数据（如密码）会以明文形式存储在 KV 中，但是加密文件分离保存
- 在生产环境中，确保启用了适当的访问控制和安全措施
- 定期备份 KV 数据以防数据丢失
- API密钥应妥善保管，不要与他人共享

## 开发说明

如果需要修改或扩展功能，请修改 `worker.js` 文件中的相应代码部分。主要功能模块包括：

- 请求验证模块
- 数据处理模块
- KV 操作模块
- 管理界面生成模块
- API 路由处理模块

## 故障排除

- 如果请求被拒绝，请检查是否正确设置了 `Content-Type: application/json` 头
- 如果登录失败，请检查环境变量 `ENV_ADMIN_PASSWORD` 是否正确设置
- 如果 KV 操作失败，请检查 KV 命名空间是否正确绑定
- 如果遇到其他问题，请查看 Cloudflare Worker 的日志获取更多信息