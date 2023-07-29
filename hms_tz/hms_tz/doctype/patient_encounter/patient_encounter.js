// Copyright (c) 2016, ESS LLP and contributors
// For license information, please see license.txt

frappe.ui.form.on('Patient Encounter', {
	setup: function(frm) {

	},

	onload:function (frm) {
		if(frm.doc.source){
			set_source_referring_practitioner(frm)
		}
	},

	refresh: function(frm) {
		refresh_field('drug_prescription');
		refresh_field('lab_test_prescription');
		if(frm.doc.patient){
			show_patient_vital_charts(frm.doc.patient, frm, "bp", "mmHg", "Blood Pressure");
		}
		else{
			frm.fields_dict.patient_vitals.html("<div align='center'>Please select Patient.</div>");
		}
		if (!frm.doc.__islocal) {
			if (frm.doc.docstatus === 1) {
				if (frm.doc.inpatient_status == 'Admission Scheduled' || frm.doc.inpatient_status == 'Admitted') {
					frm.add_custom_button(__('Schedule Discharge'), function() {
						schedule_discharge(frm);
					});
				} else if (frm.doc.inpatient_status != 'Discharge Scheduled' && !frm.doc.healthcare_package_order) {
					frm.add_custom_button(__('Schedule Admission'), function() {
						frappe.call("hms_tz.nhif.api.patient_encounter.validate_admission_encounter", {
							encounter: frm.doc.name,
							healthcare_package_order: frm.doc.healthcare_package_order
						}).then(r => {
							if (r.message) {
								return 
							} else {
								schedule_inpatient(frm);
							}
						});
					}).removeClass('btn-default').addClass('btn-warning').css({
						'font-size': '14px', 'font-weight': 'bolder'
					});
				}
				frm.add_custom_button(__('Refer Practitioner'), function() {
					refer_practitioner(frm);
				});
			}

			frm.add_custom_button(__('Patient History'), function() {
				if (frm.doc.patient) {
					frappe.route_options = {'patient': frm.doc.patient};
					frappe.set_route('tz-patient-history');
				} else {
					frappe.msgprint(__('Please select Patient'));
				}
			});

			frm.add_custom_button(__('Vital Signs'), function() {
				create_vital_signs(frm);
			},'Create');

			frm.add_custom_button(__('Medical Record'), function() {
				create_medical_record(frm);
			},'Create');

			frm.add_custom_button(__('Clinical Procedure'), function() {
				create_procedure(frm);
			},'Create');

		}

		frm.set_query('patient', function() {
			return {
				filters: {'status': 'Active'}
			};
		});

		// frm.set_query('drug_code', 'drug_prescription', function() {
		// 	return {
		// 		filters: {
		// 			is_stock_item: 1
		// 		}
		// 	};
		// });

		frm.set_query("radiology_examination_template", "radiology_procedure_prescription", function() {
			return {
				filters: {
					is_billable:'1',
					disabled: ['!=', '1']
				}
			};
		});

		frm.set_query('lab_test_code', 'lab_test_prescription', function() {
			return {
				filters: {
					is_billable: 1
				}
			};
		});

		frm.set_query('appointment', function() {
			return {
				filters: {
					//	Scheduled filter for demo ...
					status:['in',['Open','Scheduled']]
				}
			};
		});

		frm.set_query('referring_practitioner', function() {
			if(frm.doc.source == 'External Referral'){
				return {
					filters: {
						'healthcare_practitioner_type': 'External'
					}
				};
			}
			else{
				return {
					filters: {
						'healthcare_practitioner_type': 'Internal'
					}
				};
			}
		});

		frm.set_df_property('patient', 'read_only', frm.doc.appointment ? 1 : 0);
		frm.set_query('insurance_subscription', function(){
			return{
				filters:{
					'patient': frm.doc.patient,
					'docstatus': 1
				}
			};
		});
	},

	appointment: function(frm) {
		frm.events.set_appointment_fields(frm);
	},

	patient: function(frm) {
		frm.events.set_patient_info(frm);
		if(frm.doc.patient){
			show_patient_vital_charts(frm.doc.patient, frm, "bp", "mmHg", "Blood Pressure");
		}
		else{
			frm.fields_dict.patient_vitals.html("<div align='center'>Please select Patient.</div>");
		}
	},

	practitioner: function(frm) {
		if (!frm.doc.practitioner) {
			frm.set_value('practitioner_name', '');
		}
	},
	set_appointment_fields: function(frm) {
		if (frm.doc.appointment) {
			frappe.call({
				method: 'frappe.client.get',
				args: {
					doctype: 'Patient Appointment',
					name: frm.doc.appointment
				},
				callback: function(data) {
					let values = {
						'patient':data.message.patient,
						'type': data.message.appointment_type,
						'practitioner': data.message.practitioner,
						'invoiced': data.message.invoiced,
						'company': data.message.company,
						'source':data.message.source
					};
					frm.set_value(values);
					frm.set_df_property('patient', 'read_only', 1);
				}
			});
		}
		else {
			let values = {
				'patient': '',
				'patient_name': '',
				'type': '',
				'practitioner': '',
				'invoiced': 0,
				'patient_sex': '',
				'patient_age': '',
				'inpatient_record': '',
				'inpatient_status': ''
			};
			frm.set_value(values);
			frm.set_df_property('patient', 'read_only', 0);
		}
	},

	set_patient_info: function(frm) {
		if (frm.doc.patient) {
			frappe.call({
				method: 'hms_tz.hms_tz.doctype.patient.patient.get_patient_detail',
				args: {
					patient: frm.doc.patient
				},
				callback: function(data) {
					let age = '';
					if (data.message.dob) {
						age = calculate_age(data.message.dob);
					}
					let values = {
						'patient_age': age,
						'patient_name':data.message.patient_name,
						'patient_sex': data.message.sex,
						'inpatient_record': data.message.inpatient_record,
						'inpatient_status': data.message.inpatient_status
					};
					frm.set_value(values);
				}
			});
		} else {
			let values = {
				'patient_age': '',
				'patient_name':'',
				'patient_sex': '',
				'inpatient_record': '',
				'inpatient_status': ''
			};
			frm.set_value(values);
		}
	},

	source: function(frm){
		if(frm.doc.source){
			set_source_referring_practitioner(frm);
		}
	}

});

var schedule_inpatient = function(frm) {
	var count = 0
	var dialog = new frappe.ui.Dialog({
		title: 'Patient Admission',
		fields: [
			{fieldtype: 'Link', label: 'Medical Department', fieldname: 'medical_department', options: 'Medical Department', reqd: 1},
			{fieldtype: 'Link', label: 'Healthcare Practitioner (Primary)', fieldname: 'primary_practitioner', options: 'Healthcare Practitioner', reqd: 1},
			{fieldtype: 'Link', label: 'Healthcare Practitioner (Secondary)', fieldname: 'secondary_practitioner', options: 'Healthcare Practitioner'},
			{fieldtype: 'Column Break'},
			{fieldtype: 'Date', label: 'Admission Ordered For', fieldname: 'admission_ordered_for', default: 'Today'},
			{fieldtype: 'Link', label: 'Service Unit Type', fieldname: 'service_unit_type', options: 'Healthcare Service Unit Type'},
			{fieldtype: 'Int', label: 'Expected Length of Stay', fieldname: 'expected_length_of_stay'},
			{fieldtype: 'Section Break'},
			{fieldtype: 'Long Text', label: 'Admission Instructions', fieldname: 'admission_instruction'}
		],
		primary_action_label: __('Order Admission'),
		primary_action : function() {
			if (count > 0) {return}

			var args = {
				patient: frm.doc.patient,
				admission_encounter: frm.doc.name,
				referring_practitioner: frm.doc.practitioner,
				company: frm.doc.company,
				medical_department: dialog.get_value('medical_department'),
				primary_practitioner: dialog.get_value('primary_practitioner'),
				secondary_practitioner: dialog.get_value('secondary_practitioner'),
				admission_ordered_for: dialog.get_value('admission_ordered_for'),
				admission_service_unit_type: dialog.get_value('service_unit_type'),
				expected_length_of_stay: dialog.get_value('expected_length_of_stay'),
				admission_instruction: dialog.get_value('admission_instruction')
			}
			frappe.call({
				method: 'hms_tz.hms_tz.doctype.inpatient_record.inpatient_record.schedule_inpatient',
				args: {
					args: args
				},
				callback: function(data) {
					if (!data.exc) {
						frm.reload_doc();
					}
				},
				freeze: true,
				freeze_message: __('Scheduling Patient Admission')
			});
			frm.refresh_fields();
			count += 1
			dialog.hide();
		}
	});

	dialog.set_values({
		'medical_department': frm.doc.medical_department,
		'primary_practitioner': frm.doc.practitioner,
	});

	dialog.fields_dict['service_unit_type'].get_query = function() {
		return {
			filters: {
				'inpatient_occupancy': 1,
				'allow_appointments': 0
			}
		};
	};

	dialog.show();
	dialog.$wrapper.find('.modal-dialog').css('width', '800px');
};

var schedule_discharge = function(frm) {
	var dialog = new frappe.ui.Dialog ({
		title: 'Inpatient Discharge',
		fields: [
			{fieldtype: 'Date', label: 'Discharge Ordered Date', fieldname: 'discharge_ordered_date', default: 'Today', read_only: 1},
			{fieldtype: 'Date', label: 'Followup Date', fieldname: 'followup_date'},
			{fieldtype: 'Column Break'},
			{fieldtype: 'Small Text', label: 'Discharge Instructions', fieldname: 'discharge_instructions'},
			{fieldtype: 'Section Break', label:'Discharge Summary'},
			{fieldtype: 'Long Text', label: 'Discharge Note', fieldname: 'discharge_note'}
		],
		primary_action_label: __('Order Discharge'),
		primary_action : function() {
			var args = {
				patient: frm.doc.patient,
				discharge_encounter: frm.doc.name,
				discharge_practitioner: frm.doc.practitioner,
				discharge_ordered_date: dialog.get_value('discharge_ordered_date'),
				followup_date: dialog.get_value('followup_date'),
				discharge_instructions: dialog.get_value('discharge_instructions'),
				discharge_note: dialog.get_value('discharge_note')
			}
			frappe.call ({
				method: 'hms_tz.hms_tz.doctype.inpatient_record.inpatient_record.schedule_discharge',
				args: {args},
				callback: function(data) {
					if(!data.exc){
						frm.reload_doc();
					}
				},
				freeze: true,
				freeze_message: 'Scheduling Inpatient Discharge'
			});
			frm.refresh_fields();
			dialog.hide();
		}
	});

	dialog.show();
	dialog.$wrapper.find('.modal-dialog').css('width', '800px');
};

let create_medical_record = function(frm) {
	if (!frm.doc.patient) {
		frappe.throw(__('Please select patient'));
	}
	frappe.route_options = {
		'patient': frm.doc.patient,
		'status': 'Open',
		'reference_doctype': 'Patient Medical Record',
		'reference_owner': frm.doc.owner
	};
	frappe.new_doc('Patient Medical Record');
};

let create_vital_signs = function(frm) {
	if (!frm.doc.patient) {
		frappe.throw(__('Please select patient'));
	}
	frappe.route_options = {
		'patient': frm.doc.patient,
		'encounter': frm.doc.name,
		'company': frm.doc.company
	};
	frappe.new_doc('Vital Signs');
};

let create_procedure = function(frm) {
	if (!frm.doc.patient) {
		frappe.throw(__('Please select patient'));
	}
	frappe.route_options = {
		'patient': frm.doc.patient,
		'medical_department': frm.doc.medical_department,
		'company': frm.doc.company
	};
	frappe.new_doc('Clinical Procedure');
};

frappe.ui.form.on('Drug Prescription', {
	dosage: function(frm, cdt, cdn){
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
		let child = locals[cdt][cdn];
		if (child.dosage) {
			frappe.model.set_value(cdt, cdn, 'interval_uom', 'Day');
			frappe.model.set_value(cdt, cdn, 'interval', 1);
		}
	},
	period: function(frm, cdt, cdn) {
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
	},
	interval_uom: function(frm, cdt, cdn) {
		frappe.model.set_value(cdt, cdn, 'update_schedule', 1);
		let child = locals[cdt][cdn];
		if (child.interval_uom == 'Hour') {
			frappe.model.set_value(cdt, cdn, 'dosage', null);
		}
	}
});

let calculate_age = function(birth) {
	let ageMS = Date.parse(Date()) - Date.parse(birth);
	let age = new Date();
	age.setTime(ageMS);
	let years =  age.getFullYear() - 1970;
	return  years + ' Year(s) ' + age.getMonth() + ' Month(s) ' + age.getDate() + ' Day(s)';
};

let set_source_referring_practitioner = function (frm) {
	if(frm.doc.source == 'Direct'){
		frm.set_value('referring_practitioner', '');
		frm.set_df_property('referring_practitioner', 'hidden', 1);
		frm.set_df_property('referring_practitioner', 'reqd', 0);
	}
	else if(frm.doc.source == 'External Referral' || frm.doc.source == 'Referral') {
		if(frm.doc.practitioner){
			frm.set_df_property('referring_practitioner', 'hidden', 0);
			if(frm.doc.source == 'External Referral'){
				frappe.db.get_value('Healthcare Practitioner', frm.doc.practitioner, 'healthcare_practitioner_type', function(r) {
					if(r && r.healthcare_practitioner_type && r.healthcare_practitioner_type == 'External'){
						frm.set_value('referring_practitioner', frm.doc.practitioner);
					}
					else{
						frm.set_value('referring_practitioner', '');
					}
				});
				frm.set_df_property('referring_practitioner', 'read_only', 0);
			}
			else{
				frappe.db.get_value('Healthcare Practitioner', frm.doc.practitioner, 'healthcare_practitioner_type', function(r) {
					if(r && r.healthcare_practitioner_type && r.healthcare_practitioner_type == 'Internal'){
						frm.set_value('referring_practitioner', frm.doc.practitioner);
						frm.set_df_property('referring_practitioner', 'read_only', 1);
					}
					else{
						frm.set_value('referring_practitioner', '');
						frm.set_df_property('referring_practitioner', 'read_only', 0);
					}
				});
			}
			frm.set_df_property('referring_practitioner', 'reqd', 1);
		}
		else{
			frm.set_df_property('referring_practitioner', 'read_only', 0);
			frm.set_df_property('referring_practitioner', 'hidden', 0);
			frm.set_df_property('referring_practitioner', 'reqd', 1);
		}
	}
};
var show_patient_vital_charts = function(patient, frm, btn_show_id, pts, title) {
	frappe.call({
		method: "hms_tz.hms_tz.utils.get_patient_vitals",
		args:{
			patient: patient
		},
		callback: function(r) {
			if (r.message){
				var vitals_section_template =
								"<div class='col-sm-12'> \
									<div class='col-sm-12 show_chart_btns' align='center'> \
									</div> \
									<div class='col-sm-12 patient_vital_charts'> \
									</div> \
								</div>";
				var show_chart_btns_html = "<div style='padding-top:5px;'><a class='btn btn-default btn-xs btn-show-chart' \
				data-show-chart-id='bp' data-pts='mmHg' data-title='Blood Pressure'>Blood Pressure</a>\
				<a class='btn btn-default btn-xs btn-show-chart' data-show-chart-id='pulse_rate' \
				data-pts='per Minutes' data-title='Respiratory/Pulse Rate'>Respiratory/Pulse Rate</a>\
				<a class='btn btn-default btn-xs btn-show-chart' data-show-chart-id='temperature' \
				data-pts='°C or °F' data-title='Temperature'>Temperature</a>\
				<a class='btn btn-default btn-xs btn-show-chart' data-show-chart-id='bmi' \
				data-pts='' data-title='BMI'>BMI</a></div>";
				frm.fields_dict.patient_vitals.$wrapper.html(vitals_section_template);
				frm.fields_dict.patient_vitals.$wrapper.find('.show_chart_btns').html(show_chart_btns_html);
				// me.page.main.find(".show_chart_btns").html(show_chart_btns_html);
				//handler for buttons
				frm.fields_dict.patient_vitals.$wrapper.find('.btn-show-chart').on("click", function() {
					var	btn_show_id = $(this).attr("data-show-chart-id"), pts = $(this).attr("data-pts");
					var title = $(this).attr("data-title");
					show_patient_vital_charts(frm.doc.patient, frm, btn_show_id, pts, title);
				});
				var data = r.message;
				let labels = [], datasets = [];
				let bp_systolic = [], bp_diastolic = [], temperature = [];
				let pulse = [], respiratory_rate = [], bmi = [], height = [], weight = [];
				for(var i=0; i<data.length; i++){
					labels.push(data[i].signs_date+"||"+data[i].signs_time);
					if(btn_show_id=="bp"){
						bp_systolic.push(data[i].bp_systolic);
						bp_diastolic.push(data[i].bp_diastolic);
					}
					if(btn_show_id=="temperature"){
						temperature.push(data[i].temperature);
					}
					if(btn_show_id=="pulse_rate"){
						pulse.push(data[i].pulse);
						respiratory_rate.push(data[i].respiratory_rate);
					}
					if(btn_show_id=="bmi"){
						bmi.push(data[i].bmi);
						height.push(data[i].height_in_cm);
						weight.push(data[i].weight);
					}
				}
				if(btn_show_id=="temperature"){
					datasets.push({name: "Temperature", values: temperature, chartType:'line'});
				}
				if(btn_show_id=="bmi"){
					datasets.push({name: "BMI", values: bmi, chartType:'line'});
					datasets.push({name: "Height", values: height, chartType:'line'});
					datasets.push({name: "Weight", values: weight, chartType:'line'});
				}
				if(btn_show_id=="bp"){
					datasets.push({name: "BP Systolic", values: bp_systolic, chartType:'line'});
					datasets.push({name: "BP Diastolic", values: bp_diastolic, chartType:'line'});
				}
				if(btn_show_id=="pulse_rate"){
					datasets.push({name: "Heart Rate / Pulse", values: pulse, chartType:'line'});
					datasets.push({name: "Respiratory Rate", values: respiratory_rate, chartType:'line'});
				}
				new frappe.Chart( ".patient_vital_charts", {
					data: {
						labels: labels,
						datasets: datasets
					},

					title: title,
					type: 'axis-mixed', // 'axis-mixed', 'bar', 'line', 'pie', 'percentage'
					height: 200,
					colors: ['purple', '#ffa3ef', 'light-blue'],

					tooltipOptions: {
						formatTooltipX: d => (d + '').toUpperCase(),
						formatTooltipY: d => d + ' ' + pts,
					}
				});
			}else{
					frm.fields_dict.patient_vitals.html("<div align='center'>No records found</div>");
			}
		}
	});
};

var refer_practitioner = function(frm) {
	var dialog = new frappe.ui.Dialog ({
		title: 'Refer Practitioner',
		fields: [
			{ fieldtype: 'Link', label: "Referred to Department", reqd: 1, fieldname: "department", options: "Medical Department" },
			{fieldtype: 'Link', label: 'Referred to Practitioner', fieldname: 'referred_to', options: 'Healthcare Practitioner'},
			{fieldtype: 'Select', label: 'Priority', reqd: 1, fieldname: 'priority', options: '\nRoutine\nUrgent\nASAP\nCritical'},
			{fieldtype: 'Column Break'},
			{fieldtype: 'Link', label: 'Referring Reason', reqd: 1, fieldname: 'referring_reason', options: 'Referring Reason'},
			{fieldtype: 'Small Text', label: 'Referral Note', fieldname: 'referral_note'}
		],
		primary_action_label: __('Refer'),
		primary_action : function() {
			var args = {
				patient: frm.doc.patient,
				triage:frm.doc.triage,
				diagnosis:frm.doc.diagnosis,
				complaint:frm.doc.symptoms,
				patient_encounter: frm.doc.name,
				referring_practitioner: frm.doc.practitioner,
				company: frm.doc.company,
				date: frappe.datetime.get_today(),
				time: frappe.datetime.now_time(),
				priority: dialog.get_value('priority'),
				department: dialog.get_value("department"),
				referred_to_practitioner: dialog.get_value('referred_to'),
				referral_note: dialog.get_value('referral_note'),
				discharge_note: dialog.get_value('discharge_note'),
				referring_reason: dialog.get_value('referring_reason')
			}
			frappe.call ({
				method: 'hms_tz.hms_tz.doctype.patient_encounter.patient_encounter.create_patient_referral',
				args: {args},
				callback: function(data) {
					if(!data.exc){
						frm.reload_doc();
					}
				},
				freeze: true,
				freeze_message: 'Referring Practitioner..'
			});
			frm.refresh_fields();
			dialog.hide();
		}
	});

	let selected_department = dialog.get_value("department");
	dialog.fields_dict["department"].df.onchange = () => {
		if (selected_department != dialog.get_value("department")) {
			dialog.set_values({
				"referred_to": ""
			});
			selected_department = dialog.get_value("department");
		}
		if (dialog.get_value("department")) {
			dialog.fields_dict.referred_to.get_query = () => {
				return {
					filters: {
						"department": selected_department
					}
				};
			};
		}
	};

	dialog.show();
	dialog.$wrapper.find('.modal-dialog').css('width', '800px');
};
