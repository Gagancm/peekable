const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const OpenAI = require('openai');

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildPrompt(categories) {
  const enabledCategories = Object.entries(categories)
    .filter(([, config]) => config.enabled)
    .map(([key, config]) => {
      let desc = `- ${config.label}: ${config.description}`;
      if (key === 'adultContent' && config.sensitivity) {
        desc += ` (sensitivity: ${config.sensitivity})`;
      }
      if (key === 'politicalContent' && config.parentNote) {
        desc += ` (parent's concern: ${config.parentNote})`;
      }
      if (key === 'custom' && config.customRule) {
        desc += ` (rule: ${config.customRule})`;
      }
      return desc;
    });

  return `You are a child safety monitoring AI. Analyze this screenshot from a child's computer.

Determine if the screen content matches ANY of the following categories the parent wants to be alerted about:

${enabledCategories.join('\n')}

Respond with ONLY valid JSON in this exact format:
{
  "triggered": true/false,
  "category": "category key if triggered, null otherwise",
  "categoryLabel": "human readable category name if triggered, null otherwise",
  "confidence": "low", "medium", or "high",
  "description": "Brief 1-2 sentence description of what you see on screen that triggered the alert. Be specific but concise."
}

If nothing concerning is detected, set triggered to false. Only trigger if you have reasonable confidence the content matches a monitored category. Be accurate — false positives waste parent attention, false negatives miss real risks.`;
}

async function analyzeScreenshot(screenshotBuffer, categories) {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set; skipping AI analysis.');
    return { triggered: false };
  }

  const base64Image = screenshotBuffer.toString('base64');
  const prompt = buildPrompt(categories);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.1
    });

    const text = response.choices[0].message.content.trim();
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', text);
      return { triggered: false };
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI analysis failed:', err.message);
    return { triggered: false };
  }
}

module.exports = { analyzeScreenshot };
