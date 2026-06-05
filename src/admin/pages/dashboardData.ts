import { supabase } from '../services/supabase';
import { DashboardDemographics, DashboardStats } from '../types';

const queryCount = async (table: string, filter?: Record<string, unknown>) => {
  let query = supabase.from(table).select('id', { head: true, count: 'exact' });
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      query = query.eq(key, value as string);
    });
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
};

const querySafe = async <T>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch {
    return null as T | null;
  }
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [artifacts, users, activeUsers, blockedUsers, reviewCount, scannedArtifacts, audioPlays, ratingResponse, visitorRows, liveResponse] = await Promise.all([
    queryCount('artifacts'),
    queryCount('users'),
    queryCount('users', { status: 'active' }),
    // schema now uses 'active' / 'inactive' for user status
    queryCount('users', { status: 'inactive' }),
    queryCount('user_ratings'),
    querySafe(async () => {
      const { count, error } = await supabase.from('artifacts').select('id', { head: true, count: 'exact' }).not('qr_code', 'is', null);
      if (error) throw error;
      return count ?? 0;
    }),
    queryCount('audio_guides'),
    querySafe(async () => {
      const { data, error } = await supabase.from('user_ratings').select('rating', { head: false });
      if (error) throw error;
      return data as Array<{ rating?: number | null }>;
    }),
    querySafe(async () => {
      const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Array<{ created_at?: string | null }>;
    }),
    querySafe(async () => {
      const { data, error } = await supabase
        .from('live_mass')
        .select('is_live')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    }),
  ]);

  const ratings = Array.isArray(ratingResponse) ? ratingResponse.map((item) => Number(item.rating ?? 0)) : [];
  const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;

  const trendDays = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return {
      date: date.toISOString().slice(0, 10),
      count: 0,
    };
  });

  if (Array.isArray(visitorRows)) {
    visitorRows.forEach((row) => {
      if (!row?.created_at) return;
      const dateKey = new Date(row.created_at).toISOString().slice(0, 10);
      const day = trendDays.find((item) => item.date === dateKey);
      if (day) day.count += 1;
    });
  }

  const liveStatus = liveResponse && liveResponse.is_live ? 'live' : 'offline';

  return {
    artifacts,
    users,
    activeUsers,
    blockedUsers,
    reviews: reviewCount,
    liveStatus,
    totalVisitors: users,
    scannedArtifacts: Number(scannedArtifacts ?? 0),
    audioPlays: Number(audioPlays ?? 0),
    averageRating,
    visitorsTrend: trendDays,
  };
}

export async function fetchUserDemographics(): Promise<DashboardDemographics> {
  const rowsResponse = await querySafe(async () => {
    // users table now stores `age` (integer) and no longer provides birthdate/location columns
    const { data, error } = await supabase.from('users').select('gender, age');
    if (error) throw error;
    return data as Array<Record<string, any>>;
  });

  const rows = Array.isArray(rowsResponse) ? rowsResponse : [];

  const result: DashboardDemographics = {
    gender: { male: 0, female: 0, other: 0, unknown: 0 },
    ageGroups: {
      '13-17': 0,
      '18-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45-54': 0,
      '55-64': 0,
      '65+': 0,
      unknown: 0,
    },
    locations: {},
  };

  rows.forEach((row) => {
    const gender = String(row.gender ?? '').toLowerCase();
    if (gender === 'male' || gender === 'm') result.gender.male += 1;
    else if (gender === 'female' || gender === 'f') result.gender.female += 1;
    else if (gender) result.gender.other += 1;
    else result.gender.unknown += 1;

    // schema provides `age` as an integer; bucket into groups
    const ageVal = typeof row.age === 'number' ? row.age : Number(row.age);
    if (!Number.isNaN(ageVal) && ageVal >= 0) {
      if (ageVal < 18) result.ageGroups['13-17'] += 1;
      else if (ageVal < 25) result.ageGroups['18-24'] += 1;
      else if (ageVal < 35) result.ageGroups['25-34'] += 1;
      else if (ageVal < 45) result.ageGroups['35-44'] += 1;
      else if (ageVal < 55) result.ageGroups['45-54'] += 1;
      else if (ageVal < 65) result.ageGroups['55-64'] += 1;
      else result.ageGroups['65+'] += 1;
    } else {
      result.ageGroups.unknown += 1;
    }

    // locations were removed from the schema; leave locations empty so UI shows "No location data yet"
  });

  return result;
}
