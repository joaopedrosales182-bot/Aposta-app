export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    const prompt = `Você está vendo um screenshot de um bilhete de aposta esportiva de uma casa de apostas brasileira (Betano, Esportes da Sorte, Bet365, etc).

Extraia os dados e retorne SOMENTE um JSON válido, sem texto extra, sem markdown:
{
  "nome": "Brasil x Noruega",
  "odd": 5.25,
  "valor": 3.00,
  "retorno": 15.75,
  "casa": "Betano",
  "topicos": [
    {"titulo": "Brasil x Noruega", "subtopicos": ["Brasil Qualificar-se", "Brasil Equipe com mais escanteios", "Mais de 2.5 Gols — Total de Gols"]}
  ]
}

Instruções:
- "nome": resumo curto da aposta principal
- "odd": cotação decimal final (se houver odd turbinada, usa ela)
- "valor": valor apostado em reais (número)
- "retorno": ganhos potenciais em reais (número)
- "casa": nome da casa de apostas
- "topicos": array com os jogos/eventos. Cada um tem "titulo" (o jogo, ex: "Brasil x Noruega") e "subtopicos" (as seleções apostadas, ex: ["Brasil Qualificar-se", "Mais de 2.5 Gols"])
- Para campos não encontrados use null, para arrays vazios use []
Retorne APENAS o JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Claude API error', details: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    
    let parsed = {};
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch (e) {
      return res.status(500).json({ error: 'Parse error', raw: text });
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
