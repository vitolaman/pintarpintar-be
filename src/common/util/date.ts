import * as moment from 'moment';
import 'moment-timezone';

export function getCurrentTuesdayStartDatetime() {
  const now = moment();

  let fromDate = now.day(2); // Set to Tuesday
  if (now.isAfter(fromDate, 'day')) {
    fromDate.add(1, 'week');
  }
  fromDate = fromDate.startOf('day');

  const fromDateUTC = fromDate.toDate();
  return fromDateUTC;
}

export function getNextMondayEndDatetime() {
  const now = moment();

  let fromDate = now.day(2);
  if (now.isAfter(fromDate, 'day')) {
    fromDate.add(1, 'week');
  }
  fromDate = fromDate.startOf('day');

  let toDate = fromDate.clone().add(1, 'week').day(1);
  toDate = toDate.endOf('day');
  const toDateUTC = toDate.toDate();

  return toDateUTC;
}

export function getCurrentMonthStartDatetime() {
  return moment().startOf('month').toDate();
}

export function getCurrentMonthEndDatetime() {
  return moment().endOf('month').toDate();
}

export function getCurrentYearStartDatetime() {
  return moment().startOf('year').toDate();
}

export function getCurrentYearEndDatetime() {
  return moment().endOf('year').toDate();
}
