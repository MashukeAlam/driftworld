/* DRIFTWORLD — Location Picker UI
   Overlay for choosing home location: geolocation or text search via Nominatim. */

export interface LocationResult {
  lat: number;
  lng: number;
  label: string;
}

export class LocationPicker {
  private overlay!: HTMLDivElement;
  private resolve!: (result: LocationResult) => void;

  /**
   * Show the location picker. Returns a promise that resolves with the chosen location.
   */
  show(level: number, carColorHex: string): Promise<LocationResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.build(level, carColorHex);
    });
  }

  private build(level: number, carColorHex: string) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'location-picker';
    this.overlay.innerHTML = `
      <div class="lp-card">
        <div class="lp-level-badge" style="background: ${carColorHex}22; border-color: ${carColorHex};">
          <span class="lp-car-icon" style="color: ${carColorHex};">🚗</span>
          <span class="lp-level-text">LEVEL ${level}</span>
        </div>
        <h2 class="lp-title">Where is home?</h2>
        <p class="lp-subtitle">Set your home location — you'll start far away and drift back!</p>
        
        <button id="lp-geo-btn" class="lp-btn lp-btn-primary">
          <span>📍</span> Use My Location
        </button>
        
        <div class="lp-divider"><span>or</span></div>
        
        <div class="lp-search-row">
          <input id="lp-search-input" type="text" class="lp-input" 
            placeholder="Type a city or address..." autocomplete="off" />
          <button id="lp-search-btn" class="lp-btn lp-btn-small">Search</button>
        </div>
        
        <div id="lp-results" class="lp-results"></div>
        <div id="lp-status" class="lp-status"></div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    // Geo button
    document.getElementById('lp-geo-btn')!.addEventListener('click', () => {
      this.useGeolocation();
    });

    // Search
    document.getElementById('lp-search-btn')!.addEventListener('click', () => {
      this.searchLocation();
    });

    // Enter key
    document.getElementById('lp-search-input')!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.searchLocation();
    });
  }

  private async useGeolocation() {
    const status = document.getElementById('lp-status')!;
    status.textContent = 'Getting your location...';

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      this.finish({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: 'My Location',
      });
    } catch {
      status.textContent = '❌ Location access denied. Try searching instead.';
    }
  }

  private async searchLocation() {
    const input = document.getElementById('lp-search-input') as HTMLInputElement;
    const query = input.value.trim();
    if (!query) return;

    const status = document.getElementById('lp-status')!;
    const results = document.getElementById('lp-results')!;
    status.textContent = 'Searching...';
    results.innerHTML = '';

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await response.json();

      if (!data.length) {
        status.textContent = 'No results found. Try a different search.';
        return;
      }

      status.textContent = '';
      results.innerHTML = '';

      for (const item of data) {
        const btn = document.createElement('button');
        btn.className = 'lp-result-item';
        btn.textContent = item.display_name.split(',').slice(0, 3).join(', ');
        btn.addEventListener('click', () => {
          this.finish({
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            label: btn.textContent || query,
          });
        });
        results.appendChild(btn);
      }
    } catch {
      status.textContent = '❌ Search failed. Check your connection.';
    }
  }

  private finish(result: LocationResult) {
    this.overlay.classList.add('lp-fade-out');
    setTimeout(() => {
      this.overlay.remove();
      this.resolve(result);
    }, 500);
  }
}
