#!/usr/bin/env ruby
# frozen_string_literal: true

require "psych"

workflow_path = ARGV.fetch(0, ".github/workflows/deploy-worker.yml")
document = Psych.parse_file(workflow_path)
abort "workflow YAML is empty: #{workflow_path}" unless document&.root

def scalar_value(node)
  node.respond_to?(:value) ? node.value : nil
end

def validate_unique_mapping_keys(node, path = "$")
  if node.is_a?(Psych::Nodes::Mapping)
    seen = {}
    node.children.each_slice(2) do |key, value|
      name = scalar_value(key)
      abort "duplicate YAML key at #{path}: #{name}" if name && seen[name]
      seen[name] = true if name
      validate_unique_mapping_keys(value, "#{path}.#{name || "?"}")
    end
  elsif node.respond_to?(:children)
    Array(node.children).each_with_index { |child, index| validate_unique_mapping_keys(child, "#{path}[#{index}]") }
  end
end

def mapping_entries(node)
  node.children.each_slice(2).to_h { |key, value| [scalar_value(key), value] }
end

validate_unique_mapping_keys(document.root)
root = mapping_entries(document.root)
jobs = mapping_entries(root.fetch("jobs"))
jobs.each do |job_name, job_node|
  job = mapping_entries(job_node)
  steps = job.fetch("steps")
  abort "jobs.#{job_name}.steps must be a sequence" unless steps.is_a?(Psych::Nodes::Sequence)
  steps.children.each_with_index do |step_node, index|
    step = mapping_entries(step_node)
    executors = %w[run uses].select { |key| step.key?(key) }
    abort "jobs.#{job_name}.steps[#{index}] must define exactly one of run or uses" unless executors.one?
  end
end

puts "workflow structure validated: #{workflow_path}"
