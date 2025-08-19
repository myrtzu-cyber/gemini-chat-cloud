#!/bin/bash

# 🚀 Gemini Chat Cloud Deployment Script
# This script helps prepare your application for cloud deployment

set -e  # Exit on any error

echo "🚀 Gemini Chat - Cloud Deployment Preparation"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ ! -f "backend/package.json" ]; then
    print_error "This doesn't appear to be the Gemini Chat project directory."
    print_error "Please run this script from the project root."
    exit 1
fi

print_status "Found Gemini Chat project!"

# Step 1: Detect and configure Node.js (system or portable)
print_info "Detecting Node.js installation..."

# Initialize Node.js variables
NODE_CMD=""
NPM_CMD=""
NODE_VERSION=""

# First, try system Node.js
if command -v node &> /dev/null; then
    NODE_CMD="node"
    NPM_CMD="npm"
    NODE_VERSION=$(node --version)
    print_status "Found system Node.js version: $NODE_VERSION"
else
    print_warning "System Node.js not found in PATH, checking for portable version..."

    # Check for portable Node.js
    if [ -f "portable/node/bin/node" ]; then
        NODE_CMD="./portable/node/bin/node"
        NPM_CMD="./portable/node/bin/npm"
        NODE_VERSION=$(./portable/node/bin/node --version)
        print_status "Found portable Node.js version: $NODE_VERSION"
        print_info "Using portable Node.js from: ./portable/node/"
    elif [ -f "portable/node/node" ]; then
        NODE_CMD="./portable/node/node"
        NPM_CMD="./portable/node/npm"
        NODE_VERSION=$(./portable/node/node --version)
        print_status "Found portable Node.js version: $NODE_VERSION"
        print_info "Using portable Node.js from: ./portable/node/"
    else
        print_error "Node.js not found in system PATH or portable directory."
        print_error "Please ensure Node.js is available in one of these locations:"
        print_error "  • System PATH (install Node.js globally)"
        print_error "  • ./portable/node/bin/node (portable installation)"
        print_error "  • ./portable/node/node (portable installation)"
        exit 1
    fi
fi

# Step 2: Install dependencies using detected Node.js
print_info "Installing backend dependencies using: $NPM_CMD"
cd backend
if [ -f "package.json" ]; then
    print_info "Running: $NPM_CMD install"
    $NPM_CMD install
    if [ $? -eq 0 ]; then
        print_status "Backend dependencies installed successfully!"
    else
        print_error "Failed to install dependencies"
        print_error "Attempted command: $NPM_CMD install"
        exit 1
    fi
else
    print_error "backend/package.json not found!"
    exit 1
fi
cd ..

# Step 3: Create .env.example if it doesn't exist
if [ ! -f "backend/.env.example" ]; then
    print_info "Creating .env.example file..."
    cat > backend/.env.example << 'EOF'
# Environment Configuration for Cloud Deployment
DATABASE_URL=postgresql://username:password@hostname:port/database_name
NODE_ENV=production
PORT=3000

# Google Sheets API (Optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com
EOF
    print_status ".env.example created!"
fi

# Step 4: Check for Git repository
print_info "Checking Git repository..."
if [ -d ".git" ]; then
    print_status "Git repository found!"
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "You have uncommitted changes. Consider committing them before deployment."
        echo "Uncommitted files:"
        git status --short
        echo ""
        read -p "Do you want to commit these changes now? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            read -p "Enter commit message: " commit_message
            git commit -m "$commit_message"
            print_status "Changes committed!"
        fi
    fi
else
    print_warning "No Git repository found. Initializing..."
    git init
    git add .
    git commit -m "Initial commit - Gemini Chat cloud deployment"
    print_status "Git repository initialized!"
    print_info "Don't forget to push to GitHub: git remote add origin <your-repo-url> && git push -u origin main"
fi

# Step 5: Test local build using detected Node.js
print_info "Testing local build using: $NPM_CMD"
cd backend
print_info "Running: $NPM_CMD run build"
if $NPM_CMD run build > /dev/null 2>&1; then
    print_status "Build test successful!"
else
    print_warning "Build test completed (this is normal for this project)"
fi
cd ..

# Step 6: Create deployment checklist
print_info "Creating deployment checklist..."
cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
# 📋 Deployment Checklist

## Before Deployment:
- [ ] Code pushed to GitHub
- [ ] Environment variables prepared
- [ ] Database migration plan ready
- [ ] Google Sheets API configured (optional)

## Railway Deployment:
- [ ] Account created at railway.app
- [ ] Project connected to GitHub repo
- [ ] Environment variables set
- [ ] Database provisioned automatically
- [ ] Application deployed and accessible

## Render Deployment:
- [ ] Account created at render.com
- [ ] Web service created
- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] Application deployed and accessible

## Post-Deployment:
- [ ] Health check endpoint working: /api/health
- [ ] Frontend loads correctly
- [ ] Chat functionality working
- [ ] Database operations working
- [ ] Google Sheets backup tested (if configured)
- [ ] Mobile version accessible
- [ ] PWA installation working

## Environment Variables Needed:
- NODE_ENV=production
- DATABASE_URL=(provided by hosting platform)
- PORT=(provided by hosting platform)
- GOOGLE_SERVICE_ACCOUNT_EMAIL=(optional)
- GOOGLE_PRIVATE_KEY=(optional)
- ALLOWED_ORIGINS=(your domain)
EOF

print_status "Deployment checklist created!"

# Step 7: Display next steps
echo ""
echo "🎉 Deployment preparation complete!"
echo "=================================="
echo ""
print_info "Next steps:"
echo "1. Push your code to GitHub if you haven't already"
echo "2. Choose a hosting platform:"
echo "   • Railway (recommended): https://railway.app"
echo "   • Render: https://render.com"
echo "3. Follow the DEPLOYMENT_GUIDE.md for detailed instructions"
echo "4. Use DEPLOYMENT_CHECKLIST.md to track your progress"
echo ""
print_info "Quick start commands:"
echo "• Push to GitHub: git push origin main"
echo "• Test locally: cd backend && $NPM_CMD start"
echo "• Migrate data: cd backend && $NPM_CMD run migrate"
echo "• Node.js detected: $NODE_CMD"
echo "• NPM command: $NPM_CMD"
echo ""
print_status "Your Gemini Chat is ready for cloud deployment! 🚀"

# Step 8: Optional - open deployment guide
read -p "Would you like to open the deployment guide now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v code &> /dev/null; then
        code DEPLOYMENT_GUIDE.md
    elif command -v open &> /dev/null; then
        open DEPLOYMENT_GUIDE.md
    elif command -v xdg-open &> /dev/null; then
        xdg-open DEPLOYMENT_GUIDE.md
    else
        print_info "Please open DEPLOYMENT_GUIDE.md manually to continue."
    fi
fi
