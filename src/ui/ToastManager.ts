/* DRIFTWORLD — Toast Manager */
export type ToastType = 'gem' | 'flower' | 'rare' | 'expand' | 'zone' | 'boundary';

interface ToastConfig {
  icon: string;
  text: string;
}

const TOAST_CONFIGS: Record<string, ToastConfig> = {
  gem: { icon: '💎', text: '' },
  flower: { icon: '🌸', text: '' },
  rare: { icon: '✨', text: '' },
  expand: { icon: '🌍', text: 'Area expanded! New roads unlocked' },
  zone: { icon: '📍', text: '' },
  boundary: { icon: '🔮', text: 'Collect more to expand your world' },
};

export class ToastManager {
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById('toast-container')!;
  }

  show(type: ToastType, customText?: string) {
    const config = TOAST_CONFIGS[type] || { icon: '💬', text: '' };
    const text = customText || config.text;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${config.icon}</span>
      <span>${text}</span>
    `;

    this.container.appendChild(toast);

    // Remove after 2.5s
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 2500);
  }

  showCollect(type: 'gem' | 'flower' | 'rare', points: number) {
    const labels = { gem: 'Gem found!', flower: 'Flower!', rare: 'Rare find!' };
    this.show(type, `+${points} pts — ${labels[type]}`);
  }

  showExpand() {
    this.show('expand');
  }

  showBoundary() {
    this.show('boundary');
  }
}
