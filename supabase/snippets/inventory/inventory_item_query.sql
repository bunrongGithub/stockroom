select * from inventory_item;

ALTER TABLE inventory_item
ADD COLUMN default_warehouse_id int8 NULL,
ADD COLUMN default_location_id int8 NULL;



alter table inventory_item add constraint fk_inventory_item_default_warehouse_id 
  foreign key (default_warehouse_id) references warehouse(id);


alter table inventory_item add constraint fk_inventory_item_default_location_id 
  foreign key (default_location_id) references warehouse_location(id);


alter table profiles add COLUMN is_super_user boolean default false;