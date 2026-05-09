import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'eur',
  standalone: true,
})
export class EurPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '—';
    return value.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '€';
  }
}
