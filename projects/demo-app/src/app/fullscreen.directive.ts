import { Directive, HostListener } from '@angular/core';
import screenfull from 'screenfull';


@Directive({
    // tslint:disable-next-line:directive-selector
    selector: '[toggleFullscreen]',
    standalone: true
})
export class ToggleFullscreenDirective {

  @HostListener('click') onClick() {
    if (screenfull.isEnabled) {
      screenfull.toggle();
    }
  }
}
