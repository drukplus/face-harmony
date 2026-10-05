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
        error: 'Пожалуйста, загрузите оба изображения (Partner A и Partner B).'
      });
    }

    const parsedA = parseBase64Image(rawImageA);
    const parsedB = parseBase64Image(rawImageB);

    if (!parsedA?.data || !parsedB?.data) {
      return res.status(400).json({
        error: 'Некорректный формат одного или обоих изображений base64.'
      });
    }

    const systemPrompt = `Ты — беспристрастный, объективный и высокоточный эксперт по морфологии лица, визуальной антропометрии и фенотипической совместимости (assortative mating theory и теория эстетического баланса).
Твоя ключевая задача: провести РЕАЛИСТИЧНЫЙ, СТРОГИЙ и ЧУТКО ДИФФЕРЕНЦИРОВАННЫЙ сравнительный анализ двух лиц (Партнер А и Партнер Б).

ФУНДАМЕНТАЛЬНЫЕ ПРАВИЛА КАЛИБРОВКИ ШКАЛЫ (СТРОГО ОБЯЗАТЕЛЬНО):
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать всем подряд парам шаблонные средние оценки около 75-88%!
2. Обязательно используй ВЕСЬ динамический диапазон от 15% до 98%. Оценка должна резко и чутко меняться в зависимости от реальных лиц:
   - 15–39% (Выраженный диссонанс / Несовместимость типажей): кардинально разная форма черепа (например, резко круглый vs вытянутый овал), противоположный наклон или посадка глаз, дисгармония контуров носа и губ, эмоциональный или возрастной конфликт.
   - 40–59% (Контрастный дуализм / Низкое сходство): преобладают различия, лица принадлежат к разным морфотипам, общих черт мало, гармония держится только на отдельном контрасте.
   - 60–74% (Умеренная гармония / Органичный баланс): типичный хороший союз разных, но взаимодополняющих лиц без резкого диссонанса.
   - 75–88% (Высокая фенотипическая гармония): отчетливое сходство пропорций, формы глаз, контура улыбки и общего типажа.
   - 89–98% (Исключительный резонанс / Эффект близнецов): редкое, почти зеркальное морфологическое сходство архитектуры лица.
3. Не бойся ставить низкие оценки (20-45%), если лица объективно разные или не гармонируют. Не завышай баллы из вежливости!
4. overall_harmony_score рассчитывай как реальное средневзвешенное значение подметрик: geometry (30%), features (30%), expression (20%), phenotype (20%).
5. Ответ строго на русском языке в виде валидного JSON объекта без markdown-разметки вокруг.`;

    const userPrompt = `Проведи детальный сравнительный морфометрический анализ двух лиц (Партнер А — первое изображение, Партнер Б — второе изображение).

Внимательно сравни:
1. Архитектуру и пропорции овала лица (соотношение ширины к высоте, линия челюсти, скулы).
2. Форму, разрез, наклон (canthal tilt) и межзрачковое расстояние глаз, форму бровей.
3. Пропорции носа и контур губ (ширина, полнота, форма дуги Купидона).
4. Эмоциональный вектор и микромимику (теплота взгляда, глубина улыбки, напряжение).
5. Фенотипический типаж и текстурные особенности.

Выведи строго JSON по схеме:
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

Пояснения к полям:
- overall_harmony_score: целое число от 15 до 98 (строго откалиброванное по шкале выше, не округляй шаблонно!).
- verdict_title: емкий заголовок, отражающий РЕАЛЬНЫЙ уровень гармонии (например: "Резкий визуальный контраст", "Контрастный дуализм типажей", "Умеренная комплементарность", "Выраженный морфологический резонанс", "Зеркальное фенотипическое сходство").
- detailed_verdict: глубокий и честный вердикт на русском языке (3-5 предложений) с указанием как сильных сторон, так и явных визуальных различий или диссонансов.
- metrics: 4 подметрики (целые числа от 15 до 98):
  * geometry_score: пропорции, форма овала лица, угол нижней челюсти и симметрия.
  * features_score: созвучие формы глаз, губ, носа и бровей.
  * expression_score: мимический резонанс, эмоциональный тон и взгляд.
  * phenotype_score: совпадение фенотипического типажа и текстуры.
- matching_traits: массив из 2-4 конкретных похожих черт (если сходств мало, укажи минимальные).
- complementary_traits: массив из 2-4 контрастных или взаимодополняющих черт (или зон визуального контраста).`;

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
      verdict_title: parsedJson.verdict_title || 'Морфологический анализ пары',
      detailed_verdict: parsedJson.detailed_verdict || 'Детальный сравнительный анализ пропорций и черт лиц.',
      metrics: {
        geometry_score: geo,
        features_score: feat,
        expression_score: expr,
        phenotype_score: phen
      },
      matching_traits: Array.isArray(parsedJson.matching_traits) && parsedJson.matching_traits.length > 0
        ? parsedJson.matching_traits
        : ['Сходные пропорции отдельных зон лица'],
      complementary_traits: Array.isArray(parsedJson.complementary_traits) && parsedJson.complementary_traits.length > 0
        ? parsedJson.complementary_traits
        : ['Контраст архитектурных линий черепа и овала']
    };

    return res.json(sanitizedResult);
  } catch (error) {
    console.error('[FaceHarmony] /api/analyze error:', error);
    return res.status(500).json({
      error: 'Произошла ошибка при анализе лиц через ИИ. Пожалуйста, попробуйте еще раз.',
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
  console.log(`✨ FaceHarmony AI сервер успешно запущен на порту ${PORT}`);
  console.log(`🌐 Локальный адрес: http://localhost:${PORT}`);
});
