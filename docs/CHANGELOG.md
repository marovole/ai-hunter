# AI Hunter Changelog

## v1.0.0 (2024-01)

### Initial Release

- Basic AI account detection engine
- Multi-criteria detection (keywords, frequency, metadata, patterns)
- Visual marking of detected accounts
- Confidence level display (High/Medium/Low)
- Local whitelist and blacklist management
- Bilingual support (中文/English)
- Settings page with sensitivity control
- Statistics tracking
- Chrome Manifest V3 compatible

### Detection Criteria

1. **Keywords (30%)**: Bio and username keyword matching
2. **Frequency (25%)**: Posting pattern analysis
3. **Metadata (25%)**: Account age, followers ratio, avatar, bio
4. **Patterns (20%)**: AI-specific content patterns

### UI Features

- Popup with quick stats and controls
- Full settings page
- Color-coded avatar borders:
  - 🔴 High risk: Red border
  - 🟠 Possible: Orange border  
  - 🟡 Low risk: Yellow border

### Known Limitations

- Detection accuracy depends on rule configuration
- Twitter DOM changes may require selector updates
- API-based blocking may not work if Twitter updates their API
