#!/bin/bash

set -e

echo "🔧 Setting up SFTP Extension for Zed..."
echo ""

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed"
    echo ""
    echo "Please install Rust first:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "Then restart your terminal and run this script again."
    exit 1
else
    echo "✅ Rust is installed ($(rustc --version))"
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo ""
    echo "Please install Node.js first:"
    echo "  brew install node"
    echo ""
    echo "Or download from: https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed ($(node --version))"
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
else
    echo "✅ npm is installed ($(npm --version))"
fi

echo ""
echo "📦 Installing dependencies..."

# Install and build language server
echo "Building language server..."
cd server
npm install
npm run build
cd ..

echo ""
echo "🦀 Building Rust extension..."
cargo build --release

echo ""
echo "✅ Build complete!"
echo ""
echo "📝 Next steps:"
echo "1. Open Zed"
echo "2. Press Cmd+Shift+X (Extensions)"
echo "3. Click 'Install Dev Extension'"
echo "4. Select this directory: $(pwd)"
echo ""
echo "5. Create .zed/sftp.json in your project:"
echo '   {
     "host": "your-server.com",
     "username": "your-username",
     "privateKeyPath": "~/.ssh/id_rsa",
     "remotePath": "/var/www/html",
     "uploadOnSave": true
   }'
echo ""
echo "Happy coding! 🚀"

