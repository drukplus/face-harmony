require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and generous JSON body limits for high-res base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve frontend static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Gen AI client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ WARNING: GEMINI_API_KEY is not set in environment or .env file!');
}
const ai = new GoogleGenAI({ apiKey });

// Helper to extract mimeType and base64 payload from data URL or raw base64
function parseBase64Image(dataUrlOrBase64) {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    return null;
  }
  const match = dataUrlOrBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2]
    };
  }
  // Fallback assuming JPEG if raw base64
  return {
    mimeType: 'image/jpeg',
    data: dataUrlOrBase64.trim()
  };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FaceHarmony AI',
    timestamp: new Date().toISOString()
  });
});

// POST /api/analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const rawImageA = req.body.imageA || req.body.partnerA;
    const rawImageB = req.body.imageB || req.body.partnerB;

    if (!rawImageA || !rawImageB) {
      return res.status(400).json({
        error: 'Будь ласка, завантажте обидва зображення (Партнер А та Партнер Б).'
      });
    }

    const parsedA = parseBase64Image(rawImageA);
    const parsedB = parseBase64Image(rawImageB);

    if (!parsedA?.data || !parsedB?.data) {
      return res.status(400).json({
        error: 'Некоректний формат одного або обох зображень base64.'
      });
    }

    const systemPrompt = `Ти — провідний світовий експерт з візуальної антропології, морфології обличчя та теорії фенотипічної сумісності (assortative mating theory та естетичного балансу).
Твоє ключове завдання: провести РЕАЛІСТИЧНИЙ, ОБ'ЄКТИВНИЙ, СТРОГИЙ та ЧУТЛИВО ДИФЕРЕНЦІЙОВАНИЙ порівняльний аналіз двох облич (Партнер А та Партнер Б).

МОВНА ВИМОГА (СТРОГО ОБОВ'ЯЗКОВО):
Відповідай ВИКЛЮЧНО українською мовою. Усі тексти, назви вердиктів та списки рис у JSON мають бути грамотною, живою українською мовою.

ФУНДАМЕНТАЛЬНІ ПРАВИЛА КАЛІБРУВАННЯ ШКАЛИ (СТРОГО ОБОВ'ЯЗКОВО):
1. КАТЕГОРИЧНО ЗАБОРОНЕНО видавати всім парам шаблонні середні оцінки близько 75-88%!
2. Обов'язково використовуй ВЕСЬ динамічний діапазон від 15% до 98%. Оцінка має чітко й контрастно змінюватися залежно від реальних облич:
   - 15–39% (Виражений дисонанс / Несумісність типажів): кардинально різна форма черепа (наприклад, різко кругле vs видовжений вузький овал), протилежний нахил або посадка очей, дисгармонія контурів носа й губ, емоційний або мімічний конфлікт.
   - 40–59% (Контрастний дуалізм / Помірне сходження): переважають відмінності, обличчя належать до різних морфотипів, спільних рис небагато, гармонія тримається на окремому контрасті.
   - 60–74% (Помірна гармонія / Органічний баланс): гармонійний союз різних, але взаємодоповнюючих облич без різкого дисонансу.
   - 75–88% (Висока фенотипічна гармонія): виразне співзвуччя пропорцій, форми очей, контуру посмішки та загального типажу.
   - 89–98% (Винятковий резонанс / Ефект близнюків): рідкісна, майже дзеркальна морфологічна схожість архітектури обличчя.
3. Не бійся ставити низькі оцінки (20-45%), якщо обличчя об'єктивно різні або не гармоніюють. Не завищуй оцінки з ввічливості!
4. overall_harmony_score розраховуй як реальне середньозважене значення підметрик: geometry (30%), features (30%), expression (20%), phenotype (20%).
5. Відповідь строго українською мовою у вигляді валідного JSON об'єкта без будь-якої сторонньої розмітки.`;

    const userPrompt = `Проведи детальний порівняльний морфометричний аналіз двох облич (Партнер А — перше зображення, Партнер Б — друге зображення).

Уважно порівняй:
1. Архітектуру та пропорції овалу обличчя (співвідношення ширини до висоти, лінію щелепи, вилиці).
2. Форму, розріз, нахил (canthal tilt) та міжзіничну відстань очей, форму брів.
3. Пропорції носа та контур губ (ширину, повноту, форму дуги Купідона).
4. Емоційний вектор та мікроміміку (теплоту погляду, глибину посмішки, напругу м'язів).
5. Фенотипічний типаж та текстурні особливості.

Виведи строго JSON за схемою:
{
  "overall_harmony_score": 0,
  "verdict_title": "",
  "detailed_verdict": "",
  "metrics": {
    "geometry_score": 0,
    "features_score": 0,
    "expression_score": 0,
    "phenotype_score": 0
  },
  "matching_traits": [],
  "complementary_traits": []
}

Пояснення до полів (усі тексти ТІЛЬКИ українською мовою):
- overall_harmony_score: ціле число від 15 до 98 (строго відкаліброване за шкалою вище, не округлюй шаблонно!).
- verdict_title: місткий заголовок, що відображає РЕАЛЬНИЙ рівень гармонії (наприклад: "Різкий візуальний контраст", "Контрастний дуалізм типажів", "Помірна комплементарність", "Виражений морфологічний резонанс", "Дзеркальна фенотипічна схожість").
- detailed_verdict: глибокий і чесний вердикт українською мовою (3-5 речень) із зазначенням як сильних сторін, так і явних візуальних розбіжностей чи дисонансів.
- metrics: 4 підметрики (цілі числа від 15 до 98):
  * geometry_score: пропорції, форма овалу обличчя, кут нижньої щелепи та симетрія.
  * features_score: співзвуччя форми очей, губ, носа та брів.
  * expression_score: мімічний резонанс, емоційний тон та погляд.
  * phenotype_score: збіг фенотипічного типажу та текстури.
- matching_traits: масив із 2-4 конкретних схожих рис українською мовою (якщо схожостей мало, вкажи мінімальні).
- complementary_traits: масив із 2-4 контрастних або взаємодоповнюючих рис українською мовою (або зон візуального контрасту).`;

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: parsedA.mimeType,
              data: parsedA.data
            }
          },
          {
            inlineData: {
              mimeType: parsedB.mimeType,
              data: parsedB.data
            }
          },
          {
            text: userPrompt
          }
        ]
      }
    ];

    // Priority list of models based on availability
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-1.5-flash'
    ];
    let lastError = null;
    let rawResponseText = null;

    for (const model of candidateModels) {
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`[FaceHarmony] Calling Gemini API with model: ${model} (attempt ${attempts})...`);
          const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.45
            }
          });

          rawResponseText = response?.text;
          if (rawResponseText) {
            console.log(`[FaceHarmony] Success with model: ${model}`);
            break;
          }
        } catch (err) {
          console.warn(`[FaceHarmony] Model ${model} attempt ${attempts} failed:`, err.message || err);
          lastError = err;
          // If 503 high demand and still have attempt, wait 1s and retry
          if (String(err?.message || '').includes('503') && attempts < maxAttempts) {
            await new Promise(res => setTimeout(res, 1200));
            continue;
          }
          break;
        }
      }

      if (rawResponseText) break;
    }

    if (!rawResponseText) {
      throw lastError || new Error('Не удалось получить ответ от моделей Gemini.');
    }

    // Clean JSON if wrapped in markdown block
    let cleanedText = rawResponseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedJson = JSON.parse(cleanedText);

    // Validate and sanitize expected fields
    const rawScore = Number(parsedJson.overall_harmony_score);
    const m = parsedJson.metrics || {};
    const geo = !isNaN(Number(m.geometry_score)) ? Math.min(100, Math.max(0, Math.round(Number(m.geometry_score)))) : 60;
    const feat = !isNaN(Number(m.features_score)) ? Math.min(100, Math.max(0, Math.round(Number(m.features_score)))) : 60;
    const expr = !isNaN(Number(m.expression_score)) ? Math.min(100, Math.max(0, Math.round(Number(m.expression_score)))) : 60;
    const phen = !isNaN(Number(m.phenotype_score)) ? Math.min(100, Math.max(0, Math.round(Number(m.phenotype_score)))) : 60;

    const calculatedOverall = !isNaN(rawScore) && rawScore > 0
      ? Math.min(100, Math.max(0, Math.round(rawScore)))
      : Math.round(geo * 0.3 + feat * 0.3 + expr * 0.2 + phen * 0.2);

    const sanitizedResult = {
      overall_harmony_score: calculatedOverall,
      verdict_title: parsedJson.verdict_title || 'Морфологічний аналіз пари',
      detailed_verdict: parsedJson.detailed_verdict || 'Детальний порівняльний аналіз пропорцій та рис облич.',
      metrics: {
        geometry_score: geo,
        features_score: feat,
        expression_score: expr,
        phenotype_score: phen
      },
      matching_traits: Array.isArray(parsedJson.matching_traits) && parsedJson.matching_traits.length > 0
        ? parsedJson.matching_traits
        : ['Схожі пропорції окремих зон обличчя'],
      complementary_traits: Array.isArray(parsedJson.complementary_traits) && parsedJson.complementary_traits.length > 0
        ? parsedJson.complementary_traits
        : ['Контраст архітектурних ліній черепа та овалу']
    };

    return res.json(sanitizedResult);
  } catch (error) {
    console.error('[FaceHarmony] /api/analyze error:', error);
    return res.status(500).json({
      error: 'Виникла помилка під час аналізу облич через ШІ. Будь ласка, спробуйте ще раз.',
      details: error.message || String(error)
    });
  }
});

// Fallback route for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express server
app.listen(PORT, () => {
  console.log(`✨ FaceHarmony AI сервер успішно запущено на порту ${PORT}`);
  console.log(`🌐 Локальна адреса: http://localhost:${PORT}`);
});
