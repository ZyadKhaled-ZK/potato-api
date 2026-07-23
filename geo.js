const geoProviders = [
  {
    name: 'ipapi',
    fetch: async (ip) => {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, { timeout: 2000 });
      if (!res.ok) throw new Error(`ipapi ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.reason || 'ipapi error');
      return {
        country: data.country_name,
        city: data.city,
        region: data.region,
        latitude: data.latitude,
        longitude: data.longitude,
        provider: 'ipapi',
      };
    },
  },
  {
    name: 'ip-api',
    fetch: async (ip) => {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon`, { timeout: 2000 });
      if (!res.ok) throw new Error(`ip-api ${res.status}`);
      const data = await res.json();
      if (data.status === 'fail') throw new Error(data.message || 'ip-api fail');
      return {
        country: data.country,
        city: data.city,
        region: data.regionName,
        latitude: data.lat,
        longitude: data.lon,
        provider: 'ip-api',
      };
    },
  },
  {
    name: 'freegeoip',
    fetch: async (ip) => {
      const res = await fetch(`https://freegeoip.app/json/${ip}`, { timeout: 2000 });
      if (!res.ok) throw new Error(`freegeoip ${res.status}`);
      const data = await res.json();
      return {
        country: data.country_name,
        city: data.city,
        region: data.region_name,
        latitude: data.latitude,
        longitude: data.longitude,
        provider: 'freegeoip',
      };
    },
  },
];

const geoFallbackProviders = [...geoProviders];

function setProviders(providers) {
  geoFallbackProviders.length = 0;
  geoFallbackProviders.push(...providers);
}

function resetProviders() {
  geoFallbackProviders.length = 0;
  geoFallbackProviders.push(...geoProviders);
}

async function enrichIp(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return { country: 'Local', city: 'Local', region: 'Local', provider: 'local' };
  }

  for (const provider of geoFallbackProviders) {
    try {
      const result = await provider.fetch(ip);
      return result;
    } catch (err) {
      console.warn(`Geo provider ${provider.name} failed: ${err.message}`);
      continue;
    }
  }

  return { country: 'Unknown', city: 'Unknown', region: 'Unknown', provider: 'none' };
}

module.exports = { enrichIp, setProviders, resetProviders, geoProviders: geoFallbackProviders };
