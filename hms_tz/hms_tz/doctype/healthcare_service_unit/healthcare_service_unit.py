# -*- coding: utf-8 -*-
# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

from __future__ import unicode_literals

from frappe.utils.nestedset import NestedSet
import frappe
from frappe import _


class HealthcareServiceUnit(NestedSet):
    nsm_parent_field = "parent_healthcare_service_unit"

    def validate(self):
        if self.overlap_appointments:
            if not self.total_service_unit_capacity:
                frappe.throw(_("Total Service Unit Capacity is mandatory"))
            elif not float(self.total_service_unit_capacity) > 0:
                frappe.throw(_("Total Service Unit Capacity should be greater than 0"))

    def autoname(self):
        if self.company:
            suffix = " - " + frappe.get_cached_value("Company", self.company, "abbr")
            if not self.healthcare_service_unit_name.endswith(suffix):
                self.name = self.healthcare_service_unit_name + suffix
        else:
            self.name = self.healthcare_service_unit_name

    def on_update(self):
        super(HealthcareServiceUnit, self).on_update()
        self.validate_one_root()

    def after_insert(self):
        if self.is_group:
            self.allow_appointments = 0
            self.overlap_appointments = 0
            self.inpatient_occupancy = 0
        elif self.service_unit_type:
            service_unit_type = frappe.get_doc(
                "Healthcare Service Unit Type", self.service_unit_type
            )
            self.allow_appointments = service_unit_type.allow_appointments
            self.overlap_appointments = service_unit_type.overlap_appointments
            self.inpatient_occupancy = service_unit_type.inpatient_occupancy
            if self.inpatient_occupancy:
                self.occupancy_status = "Vacant"
                self.overlap_appointments = 0
