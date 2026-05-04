import { FilterState } from '../../core/models/filter.model';
import { FilterQueryParams } from '../../core/services/filter-state.service';

export interface QueryParams extends FilterQueryParams {
  offset: string;
  limit: string;
}

export function buildQueryParams(state: FilterState): QueryParams {
  const params: Partial<QueryParams> = {};

  if (state.price_min != null) params.price_min = String(state.price_min);
  if (state.price_max != null) params.price_max = String(state.price_max);
  if (state.area_min != null) params.area_min = String(state.area_min);
  if (state.area_max != null) params.area_max = String(state.area_max);
  if (state.typology.length > 0) params.typology = state.typology.join(',');
  if (state.city.length > 0) params.city = state.city.join(',');
  if (state.property_type.length > 0) params.property_type = state.property_type.join(',');
  if (state.has_garage != null) params.has_garage = String(state.has_garage);
  if (state.is_rented != null) params.is_rented = String(state.is_rented);
  if (state.lifetime_rent != null) params.lifetime_rent = String(state.lifetime_rent);
  if (state.is_favorite != null) params.is_favorite = String(state.is_favorite);
  if (state.active != null) params.active = String(state.active);
  if (state.sort) params.sort = state.sort;
  if (state.order) params.order = state.order;
  params.limit = String(state.limit);
  params.offset = String(state.offset);

  return params as QueryParams;
}
