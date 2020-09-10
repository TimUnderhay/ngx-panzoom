import { AfterViewInit, Component } from '@angular/core';

import { PanZoomConfig, PanZoomApi, PanZoomModel } from 'ngx-panzoom';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {

  panZoomConfig: PanZoomConfig = new PanZoomConfig();

  rows = [];
  columns = [];

  constructor(private panZoomApi: PanZoomApi) {

    for (let i = 0; i < 80; i++) {
      this.rows.push(i);
      this.columns.push(i);
    }
  }

  ngAfterViewInit() {

    // Seems to be more accurate than using initialPanX/Y
    this.panZoomApi.panToPoint({
      x: 500,
      y: 500
    });
  }

  modelChanged(model: PanZoomModel) {
    console.log(model);
  }
}
