const form = document.querySelector('#weather-form');
const cityInput = document.querySelector('#city-input');
const searchButton = document.querySelector('#search-button');
const fieldMessage = document.querySelector('#field-message');
const resultArea = document.querySelector('#result-area');

let activeController;
let lastCity = '';

const weatherLabels = {
  0: '맑음', 1: '대체로 맑음', 2: '부분적으로 흐림', 3: '흐림', 45: '안개', 48: '서리 안개',
  51: '이슬비', 53: '이슬비', 55: '강한 이슬비', 61: '약한 비', 63: '비', 65: '강한 비',
  71: '약한 눈', 73: '눈', 75: '강한 눈', 80: '소나기', 81: '소나기', 82: '강한 소나기',
  95: '뇌우', 96: '우박을 동반한 뇌우', 99: '강한 우박을 동반한 뇌우'
};

function setBusy(isBusy) {
  searchButton.disabled = isBusy;
  searchButton.textContent = isBusy ? '조회 중...' : '날씨 조회';
}

function setFieldError(message = '') {
  fieldMessage.textContent = message;
  cityInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function validateCity(city) {
  if (!city) return '도시 이름을 입력해주세요.';
  if (city.length < 2 || city.length > 60 || !/[A-Za-z가-힣]/.test(city) || !/^[A-Za-z가-힣À-ÿ .,'-]+$/.test(city)) {
    return '한글 또는 영문으로 올바른 도시 이름을 입력해주세요.';
  }
  return '';
}

function showLoading() {
  resultArea.innerHTML = `<div class="state-card loading-card" role="status"><div class="spinner" aria-hidden="true"></div><h2>날씨 정보를 불러오는 중입니다...</h2><p>잠시만 기다려주세요.</p></div>`;
}

function showEmpty(city) {
  resultArea.innerHTML = `<div class="state-card"><p class="state-label">검색 결과 없음</p><h2>‘${escapeHtml(city)}’에 대한 도시를 찾지 못했습니다.</h2><p>도시 이름의 철자를 확인한 후 다시 입력해주세요.</p></div>`;
}

function showError() {
  resultArea.innerHTML = `<div class="state-card error-card" role="alert"><p class="state-label">오류</p><h2>날씨 정보를 불러오지 못했습니다.</h2><p>네트워크 연결 또는 데이터 제공 상태를 확인한 후 다시 시도해주세요.</p><button class="retry-button" type="button" id="retry-button">다시 시도</button></div>`;
  document.querySelector('#retry-button').addEventListener('click', () => searchWeather(lastCity));
}

function showWeather(place, data) {
  const current = data.current;
  const rainChance = data.daily?.precipitation_probability_max?.[0];
  const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  resultArea.innerHTML = `<article class="state-card weather-card"><div class="weather-top"><p>${escapeHtml(place.admin1 ? `${place.name}, ${place.admin1}` : `${place.name}, ${place.country}`)}</p><h2>현재 날씨</h2><p class="temperature">${Math.round(current.temperature_2m)}°C</p><p>${weatherLabels[current.weather_code] || '날씨 정보'}</p></div><div class="weather-details"><div><span>체감온도</span><strong>${Math.round(current.apparent_temperature)}°C</strong></div><div><span>강수확률</span><strong>${rainChance ?? '-'}%</strong></div><div><span>풍속</span><strong>${Math.round(current.wind_speed_10m)} km/h</strong></div></div><p class="updated">조회 시각: ${date}</p></article>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}

async function searchWeather(rawCity) {
  const city = rawCity.trim();
  const error = validateCity(city);
  if (error) { setFieldError(error); cityInput.focus(); return; }
  setFieldError();
  lastCity = city;
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;
  setBusy(true);
  showLoading();
  try {
    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geocodingUrl.search = new URLSearchParams({ name: city, count: '1', language: 'ko', format: 'json' });
    const locationResponse = await fetch(geocodingUrl, { signal: controller.signal });
    if (!locationResponse.ok) throw new Error('location request failed');
    const locationData = await locationResponse.json();
    const place = locationData.results?.[0];
    if (!place) { showEmpty(city); return; }
    const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
    weatherUrl.search = new URLSearchParams({ latitude: place.latitude, longitude: place.longitude, current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m', daily: 'precipitation_probability_max', timezone: 'auto', forecast_days: '1' });
    const weatherResponse = await fetch(weatherUrl, { signal: controller.signal });
    if (!weatherResponse.ok) throw new Error('weather request failed');
    const weatherData = await weatherResponse.json();
    if (!weatherData.current) throw new Error('weather data missing');
    showWeather(place, weatherData);
  } catch (requestError) {
    if (requestError.name !== 'AbortError') showError();
  } finally {
    if (!controller.signal.aborted) setBusy(false);
  }
}

form.addEventListener('submit', event => { event.preventDefault(); searchWeather(cityInput.value); });
