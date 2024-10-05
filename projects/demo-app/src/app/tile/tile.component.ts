import { Component, computed, input } from '@angular/core';
import { Content } from '../types';

@Component({
    selector: 'app-tile',
    templateUrl: './tile.component.html',
    styleUrls: ['./tile.component.scss'],
    standalone: true
})

export class TileComponent {
  readonly content = input.required<Content>();
  readonly src = computed(
    () => `assets/${this.content().thumbnail}`
  );
}
