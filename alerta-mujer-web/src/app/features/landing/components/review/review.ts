import { TPipe } from '../../../../core/i18n/i18n';
import { Component, ElementRef, ViewChild, HostListener, AfterViewInit, OnDestroy, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  name: string;
  image: string;
  comment: string;
}

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [TPipe, CommonModule],
  templateUrl: './review.html',
  styleUrl: './review.scss'
})
export class ReviewComponent implements AfterViewInit, OnDestroy {
  testimonials: Testimonial[] = [
    {
      name: 'Valeria R.',
      image: '/avatars/valeria.svg',
      comment: 'Alerta Mujer me ha dado la tranquilidad que necesitaba. Saber que mis seres queridos pueden ayudarme en cualquier momento no tiene precio.'
    },
    {
      name: 'Camila G.',
      image: '/avatars/camila.svg',
      comment: 'La aplicación es muy intuitiva y me encanta compartir mi ubicación cuando salgo sola.'
    },
    {
      name: 'Sofía M.',
      image: '/avatars/sofia.svg',
      comment: 'Ahora mi familia sabe dónde estoy en cualquier momento. Me siento muchísimo más segura.'
    },
    {
      name: 'Laura P.',
      image: '/avatars/laura.svg',
      comment: 'Una aplicación indispensable para todas las mujeres.'
    },
    {
      name: 'Mariana C.',
      image: '/avatars/mariana.svg',
      comment: 'La recomiendo totalmente. Muy fácil de usar.'
    }
  ];

  @ViewChild('track') track!: ElementRef;
  @ViewChild('carousel') carousel!: ElementRef;

  currentIndex = 0;
  autoplayInterval: ReturnType<typeof setInterval> | null = null;
  isTransitioning = false;

  constructor() {
    afterNextRender(() => this.updateTrackTransform());
  }

  ngAfterViewInit() {
    this.updateTrackTransform();
    this.startAutoplay();
  }

  ngOnDestroy() {
    this.stopAutoplay();
  }

  get slidesPerView(): number {
    if (typeof window !== 'undefined') {
      if (window.innerWidth >= 1200) return 3;
      if (window.innerWidth >= 768) return 2;
    }
    return 1;
  }

  get maxIndex(): number {
    return Math.max(0, this.testimonials.length - this.slidesPerView);
  }

  private updateTrackTransform(): void {
    if (!this.carousel?.nativeElement || !this.track?.nativeElement) {
      return;
    }

    const containerWidth = this.carousel.nativeElement.offsetWidth;
    const slideWidth = containerWidth / this.slidesPerView;
    const gap = 24;
    const translateX = -(this.currentIndex * (slideWidth + gap));
    this.track.nativeElement.style.transform = `translateX(${translateX}px)`;
  }

  nextSlide() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.currentIndex >= this.maxIndex) {
      this.currentIndex = 0;
    } else {
      this.currentIndex++;
    }

    this.updateTrackTransform();

    setTimeout(() => {
      this.isTransitioning = false;
    }, 300);
  }

  prevSlide() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    if (this.currentIndex <= 0) {
      this.currentIndex = this.maxIndex;
    } else {
      this.currentIndex--;
    }

    this.updateTrackTransform();

    setTimeout(() => {
      this.isTransitioning = false;
    }, 300);
  }

  goToSlide(index: number) {
    if (this.isTransitioning || index === this.currentIndex) return;
    this.currentIndex = index;
    this.updateTrackTransform();
  }

  startAutoplay() {
    this.autoplayInterval = setInterval(() => {
      this.nextSlide();
    }, 4000);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
    }
  }

  pauseAutoplay() {
    this.stopAutoplay();
  }

  resumeAutoplay() {
    this.startAutoplay();
  }

  @HostListener('window:resize')
  onResize() {
    this.currentIndex = Math.min(this.currentIndex, this.maxIndex);
    this.updateTrackTransform();
  }
}