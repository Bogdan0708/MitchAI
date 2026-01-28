# Media Generation Skill

Generate images and videos for social media content using local NPU or cloud APIs.

## Quick Reference

### 🏠 Local Generation (Free, Private, NPU-powered)

```bash
# Generate food images locally
mitch-gen "Mici" "grilled Romanian sausages with mustard" 3

# Queue for batch processing
mitch-gen "Sarmale" "cabbage rolls with sour cream" 5 --queue
mitch-gen --process  # Run queued jobs

# Check queue
mitch-gen --status
```

**Best for:** Food photography, bulk content, overnight batches
**Output:** ~/media-output/

### ☁️ Cloud Generation (High quality, Video support)

```bash
# DALL-E 3 images (OpenAI)
cloud-gen image "A delicious plate of mici with mustard, professional food photography, 4k"
cloud-gen image "Romanian street food market" --quality hd --style vivid

# Imagen 3 images (Google)
cloud-gen image "Papanasi with sour cream and jam" --model imagen3

# Sora 2 videos (OpenAI)
cloud-gen video "A chef grilling mici at a Romanian food festival, cinematic" --duration 10

# Veo 3 videos (Google)  
cloud-gen video "Street food preparation in Transylvania" --model veo3 --duration 5

# List generated media
cloud-gen list
```

**Best for:** Hero images, video content, social media reels
**Output:** ~/media-output/

## Available Models

| Model | Type | Provider | Best For |
|-------|------|----------|----------|
| MitchNPU | Image | Local | Food photos, bulk |
| DALL-E 3 | Image | OpenAI | Creative, artistic |
| Imagen 3 | Image | Google | Photorealistic |
| Sora 2 | Video | OpenAI | Short videos, reels |
| Veo 3 | Video | Google | Cinematic videos |

## Prompt Tips for Food Content

### Image Prompts
```
"[dish name], professional food photography, natural lighting, 
shallow depth of field, garnished, steam rising, 4k sharp focus,
on rustic wooden table, Romanian cuisine"
```

### Video Prompts
```
"Close-up of [dish] being prepared, hands visible, sizzling sounds,
warm kitchen lighting, cinematic slow motion, appetizing, 
food commercial style"
```

## Workflow Examples

### Daily Social Media Content
```bash
# Morning: Queue local generation
mitch-gen "Mici" "sizzling on grill" 5 --queue
mitch-gen "Sarmale" "traditional recipe" 3 --queue

# Let it run overnight or:
mitch-gen --process
```

### Hero Shot for Campaign
```bash
# High-quality cloud generation
cloud-gen image "Mitch from Transylvania food truck, steaming mici, 
happy customers, golden hour lighting, documentary style" --quality hd
```

### Social Media Reel
```bash
# Generate video content
cloud-gen video "POV eating mici at Romanian street food stand, 
first person, satisfying, ASMR style" --duration 15
```

## Output Location

All generated media saved to: `~/media-output/`

Naming convention:
- Local: `{dish}_{timestamp}_{index}.png`
- DALL-E 3: `dalle3_{timestamp}.png`
- Imagen 3: `imagen3_{timestamp}.png`
- Sora 2: `sora2_{timestamp}.mp4`
- Veo 3: `veo3_{timestamp}.mp4`

## Cost Estimates

| Model | Cost per Generation |
|-------|---------------------|
| MitchNPU | Free (local) |
| DALL-E 3 | ~$0.04-0.08/image |
| Imagen 3 | ~$0.02-0.04/image |
| Sora 2 | ~$0.10-0.50/video |
| Veo 3 | Varies (Vertex AI) |
