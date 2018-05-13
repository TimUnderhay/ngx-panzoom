import { NgModule } from '@angular/core';
import { PanZoomComponent } from './panzoom.component';
import { Ng2MousewheelModule } from 'ng2-mousewheel';
import * as JQuery from 'jquery';

@NgModule({
  imports: [ Ng2MousewheelModule ],
  declarations: [ PanZoomComponent ],
  providers: [],
  exports: [ PanZoomComponent ]
})

export class Ng2PanZoomModule { }
