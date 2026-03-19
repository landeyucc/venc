# VENC 命令行工具

文件加密/解密命令行工具，与网页端完全兼容。

## 安装

确保已安装 Node.js，然后直接运行：

```bash
node cli.js <命令>
```

## 命令

### 加密文件

```bash
# 完整命令
node cli.js encrypt <输入文件> <输出文件.venc> <密码>

# 缩写命令
node cli.js enc <输入文件> <输出文件.venc> <密码>
node cli.js e <输入文件> <输出文件.venc> <密码>

# 指定原始文件名（用于解密时恢复原始名称）
node cli.js enc <输入文件> <输出文件.venc> <密码> -n <原始文件名>
node cli.js enc <输入文件> <输出文件.venc> <密码> --name <原始文件名>
```

**示例：**

```bash
node cli.js enc secret.txt secret.venc "mypassword"
node cli.js e document.pdf encrypted.pdf "123456"
node cli.js encrypt image.png photo.venc "securepass"

# 指定原始文件名
node cli.js enc file.txt output.venc "password" -n "自定义文件名.txt"
node cli.js enc a.jpg b.venc "pass" --name "原始图片.jpg"
```

---

### 解密文件（密码方式）

```bash
# 完整命令
node cli.js decrypt <输入文件.venc> [-p <密码>] [输出文件]

# 缩写命令
node cli.js dec <输入文件.venc> [-p <密码>] [输出文件]
node cli.js d <输入文件.venc> [-p <密码>] [输出文件]
```

**示例：**

```bash
node cli.js dec secret.venc -p "mypassword"
node cli.js d secret.venc -p "mypassword" output.txt
node cli.js decrypt encrypted.venc -p "123456" result.pdf
```

---

### 解密文件（vkey方式）

```bash
# 使用vkey密钥文件解密
node cli.js dec <输入文件.venc> -k <密钥文件.vkey> [输出文件]
node cli.js d <输入文件.venc> -k <密钥文件.vkey> [输出文件]
```

**示例：**

```bash
node cli.js dec secret.venc -k secret.vkey
node cli.js d encrypted.venc -k key.vkey output.pdf
```

---

### 帮助信息

```bash
node cli.js --help
node cli.js -h
node cli.js help
```

---

## 选项说明

| 选项                    | 说明                       |
| ----------------------- | -------------------------- |
| `-p, --password <密码>` | 解密密码                   |
| `-k, --vkey <文件>`     | vkey密钥文件路径           |
| `-n, --name <名称>`     | 原始文件名（仅加密时使用） |

---

## 工作流程示例

### 1. 加密文件

```bash
# 加密文件
node cli.js enc original.jpg encrypted.venc "password123"

# 输出
# 开始加密文件...
# 输入文件: original.jpg
# 原始文件名: original.jpg
# 加密进度: 100.00%
# 加密文件已保存: encrypted.venc
# 密钥文件已保存: encrypted.vkey
# 加密完成!
```

### 2. 使用密码解密

```bash
# 解密文件
node cli.js dec encrypted.venc -p "password123"

# 输出
# 开始解密文件...
# 输入文件: encrypted.venc
# 使用密码解密...
# 找到正确头部长度: 60 字节
# 解密进度: 100.00%
# 文件哈希验证成功
# 解密文件已保存: original.jpg
# 解密完成!
```

### 3. 使用vkey解密

```bash
# 使用vkey文件解密
node cli.js dec encrypted.venc -k encrypted.vkey
```

---

## 文件说明

- **`.venc`** - 加密后的文件
- **`.vkey`** - 密钥文件（可用于解密，无需密码）

---

## 注意事项

1. 加密和解密操作会在当前目录生成文件
2. 解密时如不指定输出文件名，将自动恢复原始文件名
3. 加密后的文件与网页端完全兼容
4. vkey文件与加密文件一一对应，不可混用
