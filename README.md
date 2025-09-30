# VENC File Protection
![VENC File Protection](img/venc.ico)
Go to [中文文档](README_CN.md)

A simple, efficient browser-based file encryption and protection tool that supports encrypting and decrypting various types of files.

## Features

### 🛡️ Secure Encryption
- Uses AES-GCM 256-bit encryption algorithm to protect file security
- Supports both password and recovery key protection methods
- Local processing, files are not uploaded to servers

### 🌐 Multi-language Support
- English
- Simplified Chinese
- Traditional Chinese

### 🎨 User Experience
- Intuitive interface design, easy to operate
- Dark/light mode automatically adapts to system settings
- Real-time display of encryption/decryption progress
- Support for large file processing (up to 2GB)

### 🔧 Practical Functions
- Chunk processing for large files to avoid browser crashes
- Supports file integrity verification
- Local storage of language and theme preferences

## Technology Stack

- HTML5 + CSS3
- JavaScript (ES6+)
- Web Crypto API
- Font Awesome icon library
- Neumorphism design style

## Quick Start

### Online Use
Directly visit the [VENC File Protection](https://venc.vl-x.vip/) website to start using it.

### Local Deployment
1. Clone the repository
   ```bash
   git clone https://github.com/landeyucc/venc.git
   cd venc
   ```
2. Start the HTTP server
   ```bash
   npx http-server . -p 8000
   ```
3. Open `http://127.0.0.1:8000` in your browser

## Usage

### File Encryption
1. Select "Encrypt" mode
2. Click the "Select file to encrypt" button and choose the file you want to encrypt
3. Set an encryption password of at least 4 characters
4. Click the "Start Encryption" button
5. After encryption is complete, click "Download encrypted file" and "Download key file" to save the results

### File Decryption
There are two decryption methods:

#### Decryption Using Recovery Key
1. Select "Decrypt" mode
2. Click the "Select encrypted file (.venc)" button and choose the file you want to decrypt
3. Select the "Use Recovery Key" option
4. Click the "Select key file" button and choose the corresponding .vkey file
5. Click the "Start Decryption" button
6. After decryption is complete, click "Download decrypted file" to save the result

#### Decryption Using Password
1. Select "Decrypt" mode
2. Click the "Select encrypted file (.venc)" button and choose the file you want to decrypt
3. Select the "Use Password" option
4. Enter the password set during encryption
5. Click the "Start Decryption" button
6. After decryption is complete, click "Download decrypted file" to save the result

## Security Tips

1. Please keep your encryption password and recovery key file properly; once lost, you will not be able to decrypt the files
2. It is recommended to save the encrypted file, recovery key, and password simultaneously to prevent accidental loss
3. The key file (.vkey) contains important encryption information, please keep it properly. You can use the recovery key to decrypt directly when you forget your password

## Project Structure

```
├── css/                # Style files
│   └── style.css       # Main style file
├── img/                # Image resources
│   └── venc.ico        # Website icon
├── js/                 # JavaScript files
│   ├── main.js         # Main script file
│   ├── i18n.js         # Internationalization support
│   ├── footer.js       # Footer related script
│   └── cryptoWorker.js # Encryption and decryption worker thread
├── lang/               # Language files
│   ├── en-US.js        # English translation
│   ├── zh-CN.js        # Simplified Chinese translation
│   └── zh-TW.js        # Traditional Chinese translation
├── index.html          # Main page
└── README.md           # Project description document
```

## Browser Compatibility

- Chrome (Recommended)
- Firefox
- Safari
- Edge

## Limitations

- Maximum file size: 2GB (Avoid processing overly large files, which may cause browser crashes)
- Browser must support Web Crypto API
- Encryption speed depends on device performance and file size

## Development Notes

If you want to participate in the development of this project, you can follow these steps:

1. Clone the repository to your local machine
2. Modify the code and test
3. Submit your improvements

## License

MIT License

---

Made with ❤️ by ColdSea Team