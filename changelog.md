# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Test Support for TYPO3 v13

---

## [1.1.0] – 2025-09-30

### Added
- Proxy navigation (external Prev/Next controls outside slides)
- New README section with full event documentation
- CSS hint to hide in-slide navigation buttons while keeping Submit visible

### Fixed
- Prev navigation now correctly steps back one index instead of jumping to the first step
- Spinner overlay timing: ensures consistent lock/unlock under rapid clicks

### Changed
- Centralized UI blocking with `lockUi()` / `unlockUi()` on the wrapper
- Removed JS-based hiding of in-slide navigation (now handled via CSS)

---

## [1.0.0] – 2025-09-15

### Added
- Initial release of `form_carousel`
- AJAX-based step navigation for EXT:form
- Bootstrap carousel slide animations
- Loading overlay with spinner
- Progress indicators (`dots`, `progress`, `none`)
- Developer events (`formcarousel:*`)
- Multi-form support per page
