import {
  Component,
  ElementRef,
  ChangeDetectionStrategy,
  viewChild,
  computed,
  Signal,
  signal,
  NgZone,
  OnInit,
  OnDestroy
} from '@angular/core';
import {
  PanZoomComponent,
  PanZoomModel
} from 'ngx-panzoom';
import { contentItems } from './contentItems';
import { RounderPipe } from './rounder.pipe';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleFullscreenDirective } from './fullscreen.directive';
import { TileComponent } from './tile/tile.component';
import { NgIf, NgFor } from '@angular/common';
import { calcInitialZoomToFit } from './utils';

@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [NgIf, PanZoomComponent, NgFor, TileComponent, ToggleFullscreenDirective, TooltipModule, RounderPipe, TooltipModule]
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(
    private el: ElementRef,
    private zone: NgZone
  ) {}

  readonly PanZoom = viewChild.required(PanZoomComponent);
  readonly contentItems = contentItems;
  readonly panzoomModel = signal<PanZoomModel>(undefined!);
  readonly scale: Signal<number> = computed(
    () => {
      const model = this.panzoomModel();
      return model
        ? this.getCssScale(model.zoomLevel)
        : NaN;
    }
  );
  readonly scalePerZoomLevel = signal(2.0);
  readonly neutralZoomLevel = signal(2);
  readonly canvasWidth = signal(2400);
  readonly initialZoomToFit = computed(
    // Dynamically sticks to current dimensions by virtue of resizeObserver
    () => calcInitialZoomToFit(
      this.elClientWidth(),
      this.elClientHeight(),
      this.canvasWidth()
    )
  );
  readonly elClientWidth = signal<number>(this.el.nativeElement.clientWidth);
  readonly elClientHeight = signal<number>(this.el.nativeElement.clientHeight);
  readonly observer = new ResizeObserver(
    ([entry]) => this.onElResize(entry)
  );

  ngOnInit(): void {
    this.observer.observe(this.el.nativeElement);
  }


  ngOnDestroy(): void {
    this.observer.disconnect();
  }


  private onElResize(entry: ResizeObserverEntry): void {
    const {
      inlineSize: width,
      blockSize: height
    } = entry.borderBoxSize[0];
    this.zone.run(
      () => {
        this.elClientWidth.set(
          Math.round(width)
        );
        this.elClientHeight.set(
          Math.round(height)
        );
      }
    );
  }


  private getCssScale(zoomLevel: number): number {
    return Math.pow(
      this.scalePerZoomLevel(),
      zoomLevel - this.neutralZoomLevel()
    );
  }


  onPanLeft100Clicked(): void {
    this.PanZoom().panDelta( { x: -100, y: 0 } );
  }


  onPanRight100Clicked(): void {
    this.PanZoom().panDelta( { x: 100, y: 0 } );
  }


  onPanUp100Clicked(): void {
    this.PanZoom().panDelta( { x: 0, y: -100 } );
  }


  onPanDown100Clicked(): void {
    this.PanZoom().panDelta( { x: 0, y: 100 } );
  }


  onPanLeftPercentClicked(): void {
    this.PanZoom().panDeltaPercent( { x: -20, y: 0 } );
  }


  onPanRightPercentClicked(): void {
    this.PanZoom().panDeltaPercent( { x: 20, y: 0 } );
  }


  onPanUpPercentClicked(): void {
    this.PanZoom().panDeltaPercent( { x: 0, y: -20 } );
  }


  onPanDownPercentClicked(): void {
    this.PanZoom().panDeltaPercent( { x: 0, y: 20 } );
  }
}
