import { FilterState, RentalFilterState } from '../../core/models/filter.model';
import { FilterQueryParams } from '../../core/services/filter-state.service';
import { RentalFilterQueryParams } from '../../core/services/rental-filter-state.service';

export interface QueryParams extends FilterQueryParams {
  offset: string;
  limit: string;
}

export interface RentalQueryParams extends RentalFilterQueryParams {
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
  if (state.neighborhood.length > 0) params.neighborhood = state.neighborhood.join(',');
  if (state.rental_yield_min != null) params.rental_yield_min = String(state.rental_yield_min);
  if (state.is_rented != null) params.is_rented = String(state.is_rented);
  if (state.lifetime_rent != null) params.lifetime_rent = String(state.lifetime_rent);
  if (state.has_contract_details != null)
    params.has_contract_details = String(state.has_contract_details);
  if (state.is_favorite != null) params.is_favorite = String(state.is_favorite);
  if (state.is_hidden != null) params.is_hidden = String(state.is_hidden);
  if (state.is_new != null) params.is_new = String(state.is_new);
  if (state.price_change != null) params.price_change = state.price_change;
  if (state.active != null) params.active = String(state.active);
  if (state.sort) params.sort = state.sort;
  if (state.order) params.order = state.order;
  params.limit = String(state.limit);
  params.offset = String(state.offset);

  return params as QueryParams;
}

export function buildRentalQueryParams(state: RentalFilterState): RentalQueryParams {
  const params: Partial<RentalQueryParams> = {};

  if (state.price_min != null) params.price_min = String(state.price_min);
  if (state.price_max != null) params.price_max = String(state.price_max);
  if (state.area_min != null) params.area_min = String(state.area_min);
  if (state.area_max != null) params.area_max = String(state.area_max);
  if (state.rent_price_per_m2_min != null)
    params.rent_price_per_m2_min = String(state.rent_price_per_m2_min);
  if (state.rent_price_per_m2_max != null)
    params.rent_price_per_m2_max = String(state.rent_price_per_m2_max);
  if (state.typology.length > 0) params.typology = state.typology.join(',');
  if (state.city.length > 0) params.city = state.city.join(',');
  if (state.neighborhood.length > 0) params.neighborhood = state.neighborhood.join(',');
  if (state.is_favorite != null) params.is_favorite = String(state.is_favorite);
  if (state.is_new != null) params.is_new = String(state.is_new);
  if (state.price_change != null) params.price_change = state.price_change;
  if (state.active != null) params.active = String(state.active);
  if (state.sort) params.sort = state.sort;
  if (state.order) params.order = state.order;
  params.limit = String(state.limit);
  params.offset = String(state.offset);

  return params as RentalQueryParams;
}
