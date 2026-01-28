
# Onetel Hotspot Captive Portal

A professional, high-performance registration and login gateway designed for hotspot users. Built with React, Tailwind CSS, and integrated with OpenWISP/CoovaChilli.

## 🚀 Deployment to GitHub

1. Create a new GitHub repository.
2. Push this code to the `main` branch.
3. Go to **Settings > Pages**.
4. Set **Build and deployment > Source** to `GitHub Actions`.
5. Your portal will be live in minutes.

## ⚙️ OpenWISP Integration

Copy the generated GitHub Pages URL (e.g., `https://username.github.io/repo-name/`) and paste it into your OpenWISP Hotspot configuration under:
`chilli_login_page`

## ✨ Features
- **OTP Verification**: Secure registration via mobile phone.
- **Usage Tracking**: Real-time data balance monitoring.
- **Responsive Design**: Optimized for all mobile devices.
- **OpenWISP Native**: Auto-detects `uamip` and `uamport` from redirect parameters.
