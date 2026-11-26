export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = (process.env.FOOTBALL_DATA_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'Falta configurar FOOTBALL_DATA_API_KEY en las variables de entorno de Vercel.'
    });
  }

  const { action, league, statusFilter, matchIds } = req.body || {};
  const headers = { 'X-Auth-Token': apiKey };

  try {
    if (action === 'fixtures') {
      const code = league || 'PL';
      const statusParam =
        !statusFilter || statusFilter === 'ALL'
          ? ''
          : `?status=${encodeURIComponent(statusFilter)}`;
      const url = `https://api.football-data.org/v4/competitions/${encodeURIComponent(code)}/matches${statusParam}`;
      const response = await fetch(url, { headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res.status(response.status).json({
          error: payload.message || payload.error || `Error ${response.status} en Football-Data.org`
        });
      }

      const fixtures = (payload.matches || []).map((m) => ({
        id: m.id,
        leagueCode: code,
        competitionName: m.competition?.name || code,
        home: m.homeTeam?.shortName || m.homeTeam?.name || 'Local',
        away: m.awayTeam?.shortName || m.awayTeam?.name || 'Visitante',
        utcDate: m.utcDate,
        status: m.status
      }));

      return res.status(200).json({ fixtures });
    }

    if (action === 'results') {
      const ids = Array.isArray(matchIds) ? matchIds : [];
      const results = {};

      for (const rawId of ids) {
        const id = Number(rawId);
        if (!id) continue;
        const url = `https://api.football-data.org/v4/matches/${id}`;
        const response = await fetch(url, { headers });
        if (!response.ok) continue;
        const data = await response.json().catch(() => ({}));
        const match = data.match || data;
        const finished = match.status === 'FINISHED';
        const homeGoals = match.score?.fullTime?.home;
        const awayGoals = match.score?.fullTime?.away;

        let outcome = null;
        if (finished && typeof homeGoals === 'number' && typeof awayGoals === 'number') {
          if (homeGoals > awayGoals) outcome = 'L';
          else if (homeGoals < awayGoals) outcome = 'V';
          else outcome = 'E';
        }

        results[String(rawId)] = {
          finished,
          outcome,
          homeGoals,
          awayGoals,
          status: match.status
        };
      }

      return res.status(200).json({ results });
    }

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno en el servidor' });
  }
}
