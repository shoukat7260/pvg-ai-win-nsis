# PHASE 4.2 — Before / After

## Before

- Settings: black inputs + AppShell `text-[#0a0a0a]` → black-on-black  
- Program: placeholder `VIDEO · N ms src`  
- Import: no blob URL → browser cannot play disk stubs  
- Timeline: flat rectangles  

## After

- Shared input contract (`PvgInput` / `.pvg-input` / light variant)  
- Program monitor mounts real `<video>` via blob or Tauri asset URL  
- Import registers File blobs; Tauri `media_resolve_preview`  
- Timeline type styling + toolbar groups + play sync  

## Capture for UAT

Before/after screenshots: Editor default, video selected/playing, timeline, AI, Settings input — attach during acceptance.
