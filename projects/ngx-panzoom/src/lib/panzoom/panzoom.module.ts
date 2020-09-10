import { NgModule } from '@angular/core';
import { PanZoomComponent } from './panzoom.component';
import { PanZoomApi } from '../panzoom.api';

@NgModule({
  imports: [],
  declarations: [ PanZoomComponent ],
  providers: [ PanZoomApi ],
  exports: [ PanZoomComponent ]
})

export class NgxPanZoomModule {}
