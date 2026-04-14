# OmniExtract ✦

OmniExtract is a modern, lightweight Google Chrome extension designed to instantly scrape, download, and intelligently process web content. Driven by a sleek premium dark-mode interface, it's capable of transforming messy web text into beautiful blog drafts natively via Google's Gemini Models.

<p align="center">
  <img src="icon128.png" alt="OmniExtract Logo" width="128">
</p>

## 🌟 Key Features
- **Precision Selection Mode**: Visually drag and drop across a webpage with an interactive crosshair to isolate precise text nodes and visual assets.
- **Bulk Page Extraction**: Safely scrape and compile all visible text and raw image URLs instantly from any given context window.
- **Smart AI Tools**: Native connection to `gemini-2.0-flash` capable of summarizing, identifying key points, and drafting immediate social media posts based on your highlights.
- **One-Click Exports**: ZIP up dynamically downloaded image blobs and `.txt` files securely via your browser's native protocol.

## ⚙️ How to Install (Local Sideloading)

As this is a development-level extension, you must load the folder locally into Google Chrome.

1. **Clone or Download the Repository**:
   Download this codebase or run:
   ```bash
   git clone https://github.com/Sarthakx12/Extraction-Web-Extension.git
   ```
2. **Access Chrome Configurations**: Open up your Google Chrome browser, type exactly `chrome://extensions/` into the URL bar, and hit Enter.
3. **Activate Developer Mode**: Look to the top-right corner and toggle **Developer mode** so that it is enabled.
4. **Load Unpacked**: Click the newly visible **Load unpacked** button located in the top-left section of the dashboard.
5. **Target the Folder**: Browse into your system directories and select the root `extraction-web-ext` folder (the directory containing `manifest.json`).
6. **All Set!** OmniExtract should now appear in your browser. Make sure to click the "Puzzle" icon in Chrome and hit the pin 📌 so that it rests safely on your toolbar.

## 🔑 AI Setup (Important)
Because of Google's rate limitations, you need a Google Generative AI API Token to power the smartest features:
1. Create a free API Key via [Google AI Studio](https://aistudio.google.com/app/apikey) assuring that there is a proper attached billing profile.
2. Open the `ai.js` file inside this project.
3. Paste your new key directly inside `this.apiKey`. Make sure it works!
