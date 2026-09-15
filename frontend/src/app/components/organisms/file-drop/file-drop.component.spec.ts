/**
 * file-drop — organism smoke spec (HD-008).
 *
 * Three narrow assertions:
 *   (a) the hidden <input type="file">'s change event emits
 *       fileSelected with the picked File (the click-to-browse path)
 *   (b) [currentFile] round-trips through to the displayed
 *       filename + size
 *   (c) when [disabled] is true, clicking the dropzone does NOT
 *       open the file picker (no underlying input click fired);
 *       and the projected hint slot still renders
 */

import { TestBed } from '@angular/core/testing';

import { FileDropComponent } from './file-drop.component';

describe('FileDropComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileDropComponent],
    }).compileComponents();
  });

  it('emits fileSelected with the picked File when the hidden input changes', () => {
    const fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('id', 'attachment');
    fixture.detectChanges();

    const spy = jasmine.createSpy('fileSelected');
    fixture.componentInstance.fileSelected.subscribe(spy);

    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['content'], 'note.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [fakeFile] });
    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(fakeFile);
  });

  it('displays the currentFile name and size when currentFile is set', () => {
    const fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('id', 'attachment');
    const fakeFile = new File(['x'.repeat(2048)], 'report.pdf', {
      type: 'application/pdf',
    });
    fixture.componentRef.setInput('currentFile', fakeFile);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.file-name')?.textContent).toContain('report.pdf');
    // 2048 bytes → 2.0 KB
    expect(compiled.querySelector('.file-size')?.textContent).toContain('KB');
  });

  it('renders disabled state without firing the hidden input on click', () => {
    const fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('id', 'attachment');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dropzone')?.classList.contains('disabled')).toBeTrue();

    const input = compiled.querySelector('input[type="file"]') as HTMLInputElement;
    spyOn(input, 'click');
    const zone = compiled.querySelector('.dropzone') as HTMLElement;
    zone.click();
    expect(input.click).not.toHaveBeenCalled();
  });

  it('emits fileSelected with the dropped file when a drop event fires on the dropzone', () => {
    const fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('id', 'attachment');
    fixture.detectChanges();

    const spy = jasmine.createSpy('fileSelected');
    fixture.componentInstance.fileSelected.subscribe(spy);

    const zone = fixture.nativeElement.querySelector('.dropzone') as HTMLElement;
    const fakeFile = new File(['content'], 'dropped.png', { type: 'image/png' });
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as unknown as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [fakeFile] },
    });
    zone.dispatchEvent(dropEvent);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toEqual(fakeFile);
  });

  it('emits fileSelected with null when the × remove button is clicked after currentFile is set', () => {
    const fixture = TestBed.createComponent(FileDropComponent);
    fixture.componentRef.setInput('id', 'attachment');
    const fakeFile = new File(['content'], 'note.txt', { type: 'text/plain' });
    fixture.componentRef.setInput('currentFile', fakeFile);
    fixture.detectChanges();

    const spy = jasmine.createSpy('fileSelected');
    fixture.componentInstance.fileSelected.subscribe(spy);

    const removeBtn = fixture.nativeElement.querySelector('.remove') as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    removeBtn.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.calls.mostRecent().args[0]).toBeNull();
  });
});