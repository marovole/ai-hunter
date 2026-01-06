# AI Hunter - Detect AI Twitter Accounts

A Chrome extension that detects and marks AI-generated accounts on Twitter/X.

## Features

- **AI Detection**: Automatically detect AI-generated accounts based on multiple criteria:
  - Bio/username keyword analysis
  - Posting frequency patterns
  - Account metadata analysis
  - Content pattern matching

- **Visual Marking**: Mark detected AI accounts with:
  - Color-coded avatar borders (red/orange/yellow)
  - Confidence level badges
  - Hover tooltips with detection reasons

- **Local Management**:
  - Whitelist trusted accounts
  - Blacklist suspicious accounts
  - Stats tracking

- **Bilingual Support**: 中文 and English

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `ai-hunter` folder

## Development

```
ai-hunter/
├── manifest.json              # Extension manifest
├── background.js              # Service Worker
├── popup/                     # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Options page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── content/                   # Content scripts
│   ├── content.js
│   └── styles/
│       └── ai-marker.css
├── libs/                      # Core libraries
│   ├── detector.js
│   ├── rule-engine.js
│   ├── storage.js
│   ├── twitter-api.js
│   └── i18n.js
├── rules/                     # Detection rules
│   ├── keywords.json
│   ├── patterns.json
│   ├── frequency.json
│   └── metadata.json
├── locales/                   # Translations
│   ├── zh-CN.json
│   └── en-US.json
└── icons/                     # Extension icons
```

## Configuration

### Sensitivity Levels

- **Low (1-2)**: Conservative detection, fewer false positives
- **Medium (3)**: Balanced detection
- **High (4-5)**: Aggressive detection, more results

### Auto-Block

When enabled, accounts with high confidence (>80%) will be automatically blocked.

## Privacy

- All data is stored locally in Chrome storage
- No personal data is transmitted to external servers
- Twitter session cookies are used only for blocking functionality

## License

MIT License
