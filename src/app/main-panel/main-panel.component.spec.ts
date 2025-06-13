import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainPanelComponent } from './main-panel.component';
describe('MainPanelComponent', () => {
  let component: MainPanelComponent;
  let fixture: ComponentFixture<MainPanelComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MainPanelComponent]
    });
    fixture = TestBed.createComponent(MainPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
