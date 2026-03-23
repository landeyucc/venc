# VENC 命令行工具

文件加密/解密命令行工具，与网页端完全兼容。

## 安装

确保已安装 Node.js，然后直接运行：

```bash
node cli.js <命令>
```

## 命令

### 加密文件（单文件）

```bash
# 完整命令
node cli.js encrypt <输入文件> <输出文件.venc> <密码>

# 缩写命令
node cli.js enc <输入文件> <输出文件.venc> <密码>
node cli.js e <输入文件> <输出文件.venc> <密码>
```

**示例：**

```bash
node cli.js enc secret.txt secret.venc "mypassword"
node cli.js e document.pdf encrypted.pdf "123456"
node cli.js encrypt image.png photo.venc "securepass"
```

---

### 加密文件（指定原始文件名）

```bash
# 指定原始文件名（用于解密时恢复原始名称）
node cli.js enc <输入文件> <输出文件.venc> <密码> -n <原始文件名>
node cli.js enc <输入文件> <输出文件.venc> <密码> --name <原始文件名>
```

**示例：**

```bash
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

### 批量加密（目录模式）

```bash
# 批量加密整个目录
node cli.js encrypt -f <输入目录> -o <输出目录> <密码>
node cli.js enc -f <输入目录> -o <输出目录> <密码>
```

**示例：**

```bash
node cli.js enc -f "C:\demo" -o "C:\encrypted" "mypassword"
node cli.js encrypt -f "D:\files" -o "D:\backup" "securepass"
```

---

### 批量解密（目录模式）

```bash
# 批量解密整个目录（使用密码）
node cli.js decrypt -f <输入目录> -o <输出目录> -p <密码>
node cli.js dec -f <输入目录> -o <输出目录> -p <密码>

# 批量解密整个目录（使用vkey）
node cli.js decrypt -f <输入目录> -o <输出目录> -k <vkey文件>
node cli.js dec -f <输入目录> -o <输出目录> -k <vkey文件>
```

**示例：**

```bash
node cli.js dec -f "C:\encrypted" -o "C:\decrypted" -p "mypassword"
node cli.js decrypt -f "D:\backup" -o "D:\restored" -k key.vkey
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

| 选项                    | 说明                         |
| ----------------------- | ---------------------------- |
| `-p, --password <密码>` | 解密密码                     |
| `-k, --vkey <文件>`     | vkey密钥文件路径             |
| `-n, --name <名称>`     | 原始文件名（仅加密时使用）   |
| `-f, --folder <目录>`   | 批量处理目录（需要绝对路径） |
| `-o, --output <目录>`   | 输出目录（批量模式必需）     |

---

## 工作流程示例

### 1. 加密单个文件

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

### 4. 批量加密目录

```bash
# 批量加密整个目录
node cli.js enc -f "C:\demo" -o "C:\encrypted" "mypassword"

# 输出
# 开始批量加密 3 个文件...
# 输入目录: C:\demo
# 输出目录: C:\encrypted
#
# [1/3] 处理: file1.txt
#   ✓ 加密完成: file1.txt.venc
#
# [2/3] 处理: file2.jpg
#   ✓ 加密完成: file2.jpg.venc
#
# [3/3] 处理: file3.pdf
#   ✓ 加密完成: file3.pdf.venc
#
# 批量加密完成!
# 成功: 3 个
# 失败: 0 个
```

### 5. 批量解密目录（自动匹配vkey）

```bash
# 批量解密整个目录（使用密码）
node cli.js dec -f "C:\encrypted" -o "C:\decrypted" -p "mypassword"

# 输出
# 开始批量解密 3 个文件...
# 输入目录: C:\encrypted
# 输出目录: C:\decrypted
#
# [1/3] 处理: file1.txt.venc
# 使用密码解密...
# 找到匹配的vkey文件: file1.txt.vkey
#   文件哈希验证成功
#   ✓ 解密完成: file1.txt
#
# [2/3] 处理: file2.jpg.venc
# 使用密码解密...
# 找到匹配的vkey文件: file2.jpg.vkey
#   文件哈希验证成功
#   ✓ 解密完成: file2.jpg
#
# [3/3] 处理: file3.pdf.venc
# 使用密码解密...
# 找到匹配的vkey文件: file3.pdf.vkey
#   文件哈希验证成功
#   ✓ 解密完成: file3.pdf
#
# 批量解密完成!
# 成功: 3 个
# 失败: 0 个
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
5. 批量模式使用绝对路径，如 `C:\demo`
6. 批量模式按序单线程处理文件
7. 批量模式会显示处理进度和成功/失败统计
8. **批量解密时自动匹配同名vkey文件**：当使用密码解密时，CLI会自动查找与加密文件同名的vkey文件（如 `file.txt.venc` 会自动匹配 `file.txt.vkey`），找到后优先使用vkey解密
9. **批量加密生成独立vkey文件**：每个加密文件都会生成对应的vkey文件，确保文件安全
