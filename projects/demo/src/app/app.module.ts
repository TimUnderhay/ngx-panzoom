import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NgxPanZoomModule } from 'ngx-panzoom';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    NgxPanZoomModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
