# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-28
### Added
- **Product Key Activation Gate:** A robust, modern full-screen activation gate blocking access to the app until a valid product key (`EDU-XXXX-XXXX-XXXX`) is provided.
- Proprietary licensing via EULA.
- End-to-end Playwright tests covering the solver lifecycle.
- Excel Export unit tests to verify sheet structure mapping.

### Changed
- **Persistence Hardening:** Storage operations now utilize an atomic temp-and-rename pattern, synchronous flushing on profile switch, and `beforeunload` warnings for unsaved data.
- **Validation Hardening:** Replaced loose object passthroughs with strict Zod schemas (`Subject`, `Teacher`, `Room`, `ClassGroup`) to prevent malformed data injections.
- **Observability:** Scheduler Web Worker now serializes and propagates full error stack traces to the main UI thread for improved production debugging.
