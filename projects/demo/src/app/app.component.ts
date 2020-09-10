import { Component } from '@angular/core';
import { PanZoomConfig } from 'ngx-panzoom';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  panZoomConfig: PanZoomConfig = new PanZoomConfig();

  rows = [];
  columns = [];

  constructor() {

    for (let i = 0; i < 80; i++) {
      this.rows.push(i);
      this.columns.push(i);
    }
  }
}
