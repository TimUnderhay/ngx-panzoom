import { PanZoomApi } from './panzoom.api';
import { NgModule } from '@angular/core';
import { PanZoomComponent } from './panzoom.component';

@NgModule({
  imports: [],
  declarations: [ PanZoomComponent ],
  providers: [ PanZoomApi ],
  exports: [ PanZoomComponent ]
})

export class NgxPanZoomModule {}
