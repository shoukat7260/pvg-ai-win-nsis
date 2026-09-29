# PVG AI — Preview Architecture

**Phase:** 3 — Source monitor via native/HTML media element  
**Future:** Sequence compositor (Phase 4+, deferred)  
**Time rule:** Frame-accurate seeks internally; float seconds for display only

---

## 1. Phase 3 Scope

Preview is a **source monitor**: play/pause/seek one media asset (or its proxy) in the desktop WebView.

| In scope | Out of scope (deferred) |
|----------|-------------------------|
| `<video>` / `<audio>` / `<img>` | Multi-clip sequence compositor |
| Path → playable URL conversion | WebCodecs custom pipeline |
| Prefer proxy when available | Effects, color, transitions |
| Frame/timecode display helpers | Full program monitor for NLE |

Architecture must not paint into a corner: APIs are shaped so a later compositor can replace the media-element backend without rewriting the asset/job model.

---

## 2. Playback Stack (Phase 3)

```
UI PreviewPane
  → resolve PlaybackSource { assetId, preferProxyProfile }
  → native command: resolve_media_url(assetId, mode)
  → convert absolute/relative path → Tauri asset / converted file URL
  → bind to HTMLMediaElement or <img>
  → UI controls: play, pause, scrub (display seconds ↔ frame)
```

### Path conversion

- UI never receives unrestricted FS. It receives a **converted URL** suitable for the WebView (Tauri asset protocol / custom protocol / app-allowed scope).
- LINK assets: absolute path validated under policy, then converted.
- COPY assets: path resolved inside the `.pvg` bundle, then converted.
- Proxy mode: resolve `proxies/<assetId>/<profile>/…` first when `READY`.

### Unsupported containers

If the HTML element cannot decode the source:

- Show clear “unsupported for preview” state  
- Offer generate proxy (often H.264/AAC in MP4 for broad HTML support)  
- Do not pretend frames are playing  

---

## 3. Time & Scrubbing

| Concern | Approach |
|---------|----------|
| Seek target | Frame index or rational time under project/sequence `frameRate` |
| `<video>.currentTime` | Float seconds — **display/transport adapter only** |
| Timecode UI | Format from frame utilities |
| In/Out markers (foundation) | Store as frames on sequence/clip stubs when present |

Never persist edit decisions as float-only seconds.

---

## 4. Proxy Preference

Order:

1. User-selected proxy profile if file ready  
2. Project default proxy profile  
3. Source file  
4. Error / generate CTA  

Switching profile mid-session rebinds the element `src` and restores playhead via frame → seconds adapter.

---

## 5. Extension Point: Sequence Compositor (deferred)

Design seam:

```
interface PreviewBackend {
  load(source: PreviewSource): Promise<void>;
  play(): void;
  pause(): void;
  seekFrames(frame: number): void;
  getFrame(): number;
  dispose(): void;
}

// Phase 3
class HtmlMediaPreviewBackend implements PreviewBackend { … }

// Phase 4+
class SequenceCompositorBackend implements PreviewBackend { … }
```

`PreviewSource` may later be `AssetRef` | `SequenceRef`. Phase 3 only implements `AssetRef`. Sequence persistence exists in schema v2 as foundation; compositor is not required for Phase 3 acceptance of source preview.

---

## 6. Performance Notes

- Do not decode full masters on the UI thread via JS.
- Prefer proxies for scrubbing large files.
- Thumbnail filmstrip (if present) is separate from realtime preview decode.
- Job system builds derivatives; preview only consumes them.

---

## 7. Security

- Converted URLs must not expose vault paths or secrets.
- Asset IDs and relative paths validated; reject `..`.
- No remote preview URLs required for Phase 3 local projects.

---

## 8. Related Documents

- [MEDIA-ENGINE-ARCHITECTURE.md](./MEDIA-ENGINE-ARCHITECTURE.md)
- [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md)
- [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md)
- [JOB-SYSTEM.md](./JOB-SYSTEM.md)
