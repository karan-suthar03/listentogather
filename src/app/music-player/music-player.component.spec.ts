import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MusicPlayerComponent} from './music-player.component';

describe('MusicPlayerComponent', () => {
  let component: MusicPlayerComponent;
  let fixture: ComponentFixture<MusicPlayerComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MusicPlayerComponent]
    });
    fixture = TestBed.createComponent(MusicPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
