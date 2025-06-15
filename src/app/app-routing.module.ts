import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {RoomComponent} from './room/room.component';
import {LandingComponent} from './landing/landing.component';

const routes: Routes = [
  {path: '', component: LandingComponent},
  {path: 'room/:roomCode', component: RoomComponent},
  {path: '**', redirectTo: '/'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
